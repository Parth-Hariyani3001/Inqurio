from __future__ import annotations

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from src.config.main import Config


def _build_rewrite_model() -> ChatOpenAI:
    return ChatOpenAI(
        model=Config.chat_model or "gpt-4o-mini",
        api_key=SecretStr(Config.ai_api_key),
        base_url=Config.ai_base_url or None,
        temperature=0,
        streaming=False,
    )


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
        return cleaned

    # Skip rewrite when there is no prior context to resolve against.
    if not history:
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
        model = _build_rewrite_model()
        response = await model.ainvoke(prompt)
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
