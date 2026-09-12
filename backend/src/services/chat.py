from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

from langchain_core.messages import HumanMessage
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.agent.chat_agent import build_chat_agent, history_to_langchain_messages
from src.agent.guardrails import build_grounded_user_message
from src.db.models import ChatRole, Message
from src.errors.exceptions import BadRequestError
from src.rag.query_rewrite import rewrite_retrieval_query
from src.rag.retrieval import search_paper_chunks
from src.schemas.sessions import MessageResponse
from src.services.papers import PaperService
from src.services.sessions import SessionService


def _message_response(message: Message) -> dict[str, Any]:
    payload = MessageResponse(
        uid=message.uid,
        content=message.content,
        role=message.role,
        citations=message.citations or {},
        created_at=message.created_at,
    )
    return payload.model_dump(mode="json")


def _excerpt(text: str, limit: int = 240) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return f"{cleaned[: limit - 1]}…"


def _merge_paper_citations(
    bucket: list[dict[str, Any]],
    payload: Any,
) -> None:
    items: list[Any]
    if isinstance(payload, dict):
        items = payload.get("paper") or []
    elif isinstance(payload, list):
        items = payload
    else:
        return

    seen = {item.get("chunk_id") for item in bucket if isinstance(item, dict)}
    for item in items:
        if not isinstance(item, dict):
            continue
        chunk_id = item.get("chunk_id")
        if not chunk_id or chunk_id in seen:
            continue
        excerpt = item.get("excerpt") or item.get("content") or ""
        bucket.append(
            {
                "chunk_id": str(chunk_id),
                "section": item.get("section") or "",
                "excerpt": _excerpt(str(excerpt)),
            }
        )
        seen.add(chunk_id)


def _merge_web_citations(
    bucket: list[dict[str, Any]],
    payload: Any,
) -> None:
    items: list[Any] = []
    if isinstance(payload, dict):
        if isinstance(payload.get("results"), list):
            items = payload["results"]
        elif isinstance(payload.get("web"), list):
            items = payload["web"]
        elif "url" in payload:
            items = [payload]
    elif isinstance(payload, list):
        items = payload

    seen = {item.get("url") for item in bucket if isinstance(item, dict)}
    for item in items:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        if not url or url in seen:
            continue
        bucket.append(
            {
                "title": str(item.get("title") or url),
                "url": str(url),
                "snippet": _excerpt(str(item.get("content") or item.get("snippet") or "")),
            }
        )
        seen.add(url)


def _ingest_tool_output(
    citations: dict[str, list[dict[str, Any]]],
    tool_name: str,
    output: Any,
) -> None:
    parsed = output
    if isinstance(output, str):
        try:
            parsed = json.loads(output)
        except json.JSONDecodeError:
            return

    name = tool_name.lower()
    if "retrieve_paper" in name or name == "retrieve_paper_context":
        _merge_paper_citations(citations["paper"], parsed)
        return

    if (
        "tavily" in name
        or "web_search" in name
        or "search_paper_background" in name
        or name == "tavily_search"
    ):
        _merge_web_citations(citations["web"], parsed)


def _token_text(chunk_content: Any) -> str:
    if chunk_content is None:
        return ""

    if isinstance(chunk_content, str):
        return chunk_content

    if isinstance(chunk_content, list):
        parts: list[str] = []
        for item in chunk_content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text") or ""))
            elif hasattr(item, "text"):
                parts.append(str(getattr(item, "text") or ""))
        return "".join(parts)

    return str(chunk_content)


class ChatService:
    def __init__(self) -> None:
        self.session_service = SessionService()
        self.paper_service = PaperService()

    async def stream_message(
        self,
        *,
        session_id: UUID,
        user_id: UUID,
        content: str,
        session: AsyncSession,
    ) -> AsyncIterator[tuple[str, dict[str, Any]]]:
        cleaned = content.strip()

        if not cleaned:
            raise BadRequestError(message="Message cannot be empty")

        if len(cleaned) > 8000:
            raise BadRequestError(message="Message is too long")
        chat = await self.session_service._get_chat_for_user(
            session_id,
            user_id,
            session,
        )

        paper = await self.paper_service.get_paper_by_id(chat.paper_id, session)
        paper_title = paper.title if paper else "the attached research paper"

        user_message = Message(
            chat_id=chat.uid,
            user_id=user_id,
            content=cleaned,
            role=ChatRole.USER,
            citations={},
        )
        session.add(user_message)
        await session.commit()
        await session.refresh(user_message)

        yield ("message.user", {"message": _message_response(user_message)})

        history_result = await session.exec(
            select(Message)
            .where(col(Message.chat_id) == chat.uid)
            .order_by(col(Message.created_at).asc())
        )
        history = list(history_result.all())
        # Exclude the just-saved user turn from history; it is sent as the new HumanMessage.
        prior = [message for message in history if message.uid != user_message.uid]
        lc_messages = history_to_langchain_messages(prior)

        retrieval_query = await rewrite_retrieval_query(
            cleaned,
            history=lc_messages,
            paper_title=paper_title,
        )
        paper_hits = await search_paper_chunks(chat.paper_id, retrieval_query)
        lc_messages.append(
            HumanMessage(content=build_grounded_user_message(
                cleaned, paper_hits))
        )

        agent = build_chat_agent(chat.paper_id, paper_title)
        citations: dict[str, list[dict[str, Any]]] = {"paper": [], "web": []}
        _merge_paper_citations(citations["paper"], {"paper": paper_hits})
        assistant_parts: list[str] = []

        try:
            async for event in agent.astream_events(
                {"messages": lc_messages},
                version="v2",
            ):
                kind = event.get("event")
                if kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    text = _token_text(getattr(chunk, "content", None))
                    if not text:
                        continue

                    assistant_parts.append(text)
                    yield ("message.assistant.delta", {"delta": text})

                elif kind == "on_tool_end":
                    tool_name = str(event.get("name") or "")
                    tool_output = event.get("data", {}).get("output")
                    if hasattr(tool_output, "content"):
                        tool_output = tool_output.content

                    _ingest_tool_output(citations, tool_name, tool_output)

        except Exception as exc:
            yield (
                "error",
                {
                    "detail": str(exc) or "Chat agent failed",
                },
            )
            return

        assistant_text = "".join(assistant_parts).strip()
        if not assistant_text:
            assistant_text = (
                "I could not generate a response. Please try asking again."
            )

        assistant_message = Message(
            chat_id=chat.uid,
            user_id=user_id,
            content=assistant_text,
            role=ChatRole.ASSISTANT,
            citations=citations,
        )
        session.add(assistant_message)
        await session.commit()
        await session.refresh(assistant_message)

        yield (
            "message.assistant.done",
            {"message": _message_response(assistant_message)},
        )
