from __future__ import annotations

from uuid import UUID

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from pydantic import SecretStr

from src.agent.guardrails import build_system_prompt
from src.agent.tools import build_agent_tools
from src.config.main import Config
from src.db.models import ChatRole, Message


def build_chat_model() -> ChatOpenAI:
    return ChatOpenAI(
        model=Config.chat_model or "gpt-4o-mini",
        api_key=SecretStr(Config.ai_api_key),
        base_url=Config.ai_base_url or None,
        temperature=0.2,
        streaming=True,
    )


def build_chat_agent(paper_id: UUID, paper_title: str):
    tools = build_agent_tools(paper_id)
    model = build_chat_model()
    return create_react_agent(
        model,
        tools,
        prompt=SystemMessage(content=build_system_prompt(paper_title)),
    )


def history_to_langchain_messages(
    messages: list[Message],
    *,
    limit: int = 20,
) -> list[BaseMessage]:
    recent = messages[-limit:]
    converted: list[BaseMessage] = []

    for message in recent:
        if message.role == ChatRole.USER:
            converted.append(HumanMessage(content=message.content))

        elif message.role == ChatRole.ASSISTANT:
            converted.append(AIMessage(content=message.content))

    return converted
