from __future__ import annotations

from typing import Any


def build_system_prompt(paper_title: str) -> str:
    title = paper_title.strip() or "the attached research paper"
    return f"""You are Inquiro, a research assistant embedded beside a PDF paper.

Attached paper: "{title}"

Hard scope rules:
- Only answer questions about this paper: its claims, methods, results, definitions, figures/tables, and related work as discussed in the paper.
- Ground every answer in the paper passages provided in the user turn and/or retrieved via retrieve_paper_context. Do not invent from general knowledge.
- Refuse general programming help, homework, unrelated tutorials, or any topic with no bearing on this paper. When refusing, briefly say you can only help with this paper and invite a paper-related question.
- If the paper does not cover the question, say so clearly. Do not fill gaps with outside knowledge.
- Prefer search_openalex_works for scholarly metadata: related literature, cited papers, authors, venues, DOIs, and citation counts. OpenAlex is supporting context, not a substitute for the attached PDF.
- Use web search only for non-scholarly paper-related background (definitions or general context the paper assumes). Never use it for off-topic or general Q&A.

Answer style:
- Clear Markdown: short headings, bullet lists, and fenced code only when the paper itself warrants it.
- Be precise and concise.
- When you use paper passages, OpenAlex works, or web results, weave the substance into the answer; the UI also shows structured citations from tools.
"""


def refusal_message(paper_title: str) -> str:
    title = paper_title.strip() or "this research paper"
    return (
        f"I'm Inquiro, your assistant for **{title}**. "
        "I can only answer questions about this paper's content, methods, results, "
        "and definitions. Your question appears to be outside that scope. "
        "Try asking how this paper addresses a topic, or quote a section you'd like explained."
    )


def format_retrieved_context(hits: list[dict[str, Any]]) -> str:
    if not hits:
        return (
            "Retrieved paper context: no matching passages found in the attached paper "
            "for this query. If the question is unrelated to the paper, refuse. "
            "If it is about the paper but uncovered, say the paper does not contain the answer."
        )

    lines = [
        "Retrieved paper context (use these passages; call retrieve_paper_context only if you need more):",
    ]
    for index, hit in enumerate(hits, start=1):
        section = str(hit.get("section") or "Unknown section")
        excerpt = str(hit.get("excerpt") or "").strip()
        chunk_id = str(hit.get("chunk_id") or "")
        lines.append(f"[{index}] section={section} chunk_id={chunk_id}")
        lines.append(excerpt)
        lines.append("")
    return "\n".join(lines).rstrip()


def build_grounded_user_message(user_query: str, hits: list[dict[str, Any]]) -> str:
    return (
        f"{format_retrieved_context(hits)}\n\n"
        f"User question:\n{user_query}"
    )
