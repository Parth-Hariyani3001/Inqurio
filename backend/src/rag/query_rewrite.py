from __future__ import annotations

import logging
import re
import time

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from src.config.main import Config

logger = logging.getLogger(__name__)

_rewrite_model: ChatOpenAI | None = None

# Pronouns / demonstratives that usually need history to resolve.
_ANAPHORA_RE = re.compile(
    r"\b("
    r"it|its|itself|"
    r"they|them|their|theirs|themselves|"
    r"he|him|his|himself|"
    r"she|her|hers|herself|"
    r"this|that|these|those|"
    r"former|latter|"
    r"above|below|aforementioned|"
    r"same|such"
    r")\b",
    re.IGNORECASE,
)


def _get_rewrite_model() -> ChatOpenAI:
    global _rewrite_model
    if _rewrite_model is None:
        model = Config.rewrite_model or Config.chat_model or "gpt-4o-mini"
        base_url = Config.rewrite_ai_base_url or Config.ai_base_url or None
        _rewrite_model = ChatOpenAI(
            model=model,
            api_key=SecretStr(Config.ai_api_key),
            base_url=base_url,
            temperature=0,
            max_tokens=64,
            streaming=False,
        )
    return _rewrite_model


def _needs_rewrite(query: str) -> bool:
    """Skip LLM rewrite when the query has no clear anaphora/reference cues."""
    return bool(_ANAPHORA_RE.search(query))


def will_rewrite_retrieval_query(
    user_query: str,
    *,
    history: list[BaseMessage] | None = None,
) -> bool:
    """True when rewrite_retrieval_query will call the LLM."""
    cleaned = user_query.strip()
    if not cleaned:
        return False
    if not Config.rag_query_rewrite_enabled:
        return False
    if not history:
        return False
    return _needs_rewrite(cleaned)


def _history_snippet(history: list[BaseMessage], *, limit: int = 6) -> str:
    lines: list[str] = []
    for message in history[-limit:]:
        if isinstance(message, HumanMessage):
            role = "User"
        elif isinstance(message, AIMessage):
            role = "Assistant"
        else:
            continue
        content = str(message.content or "").strip()
        if not content:
            continue
        if len(content) > 400:
            content = f"{content[:399]}…"
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def rewrite_retrieval_query(
    user_query: str,
    *,
    history: list[BaseMessage] | None = None,
    paper_title: str | None = None,
) -> str:
    """Turn a conversational question into a standalone paper search query."""
    cleaned = user_query.strip()
    if not cleaned:
        return cleaned

    if not Config.rag_query_rewrite_enabled:
        logger.info("rag.rewrite skipped reason=disabled")
        return cleaned

    # Skip rewrite when there is no prior context to resolve against.
    if not history:
        logger.info("rag.rewrite skipped reason=no_history")
        return cleaned

    if not _needs_rewrite(cleaned):
        logger.info("rag.rewrite skipped reason=no_anaphora")
        return cleaned

    title = (paper_title or "the attached research paper").strip()
    history_text = _history_snippet(history)
    prompt = (
        "Rewrite the user's latest question into a standalone search query "
        "for retrieving passages from a research paper.\n"
        "- Expand pronouns and vague references using the chat history.\n"
        "- Keep key terms, method names, acronyms, and entities.\n"
        "- Do not answer the question.\n"
        "- Return only the rewritten query text.\n\n"
        f"Paper: {title}\n"
        f"Chat history:\n{history_text or '(none)'}\n\n"
        f"Latest question:\n{cleaned}"
    )

    try:
        model = _get_rewrite_model()
        started = time.perf_counter()
        response = await model.ainvoke(prompt)
        logger.info(
            "rag.rewrite elapsed_ms=%.1f",
            (time.perf_counter() - started) * 1000,
        )
        content = response.content
        if isinstance(content, list):
            text = "".join(
                str(part.get("text") if isinstance(part, dict) else part)
                for part in content
            )
        else:
            text = str(content or "")

        rewritten = " ".join(text.strip().split())
        if not rewritten:
            return cleaned
        if (
            len(rewritten) >= 2
            and rewritten[0] == rewritten[-1]
            and rewritten[0] in {'"', "'"}
        ):
            rewritten = rewritten[1:-1].strip()
        return rewritten or cleaned
    except Exception:
        return cleaned
