"""
Pluggable LLM providers for RAG generation (Groq, OpenAI, Anthropic, Ollama).
"""
from __future__ import annotations

import logging
import os
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from backend.app.core.config import settings

logger = logging.getLogger("dex-core")


def get_llm(**kwargs: Any) -> BaseChatModel:
    """Return chat model based on LLM_PROVIDER setting."""
    provider = (settings.LLM_PROVIDER or "groq").lower()
    temperature = kwargs.get("temperature", 0)
    model = kwargs.get("model_name") or settings.LLM_MODEL_NAME

    if provider == "openai":
        return _openai_llm(model, temperature)
    if provider == "anthropic":
        return _anthropic_llm(model, temperature)
    if provider == "ollama":
        return _ollama_llm(model, temperature)
    return _groq_llm(model, temperature)


def _groq_llm(model: str, temperature: float) -> BaseChatModel:
    from langchain_groq import ChatGroq

    keys = settings.get_groq_api_keys()
    if not keys:
        raise ValueError("GROQ_API_KEY required for groq LLM provider")
    return ChatGroq(model_name=model, temperature=temperature, groq_api_key=keys[0])


def _openai_llm(model: str, temperature: float) -> BaseChatModel:
    from langchain_openai import ChatOpenAI

    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY required for openai LLM provider")
    return ChatOpenAI(model=model, temperature=temperature, api_key=settings.OPENAI_API_KEY)


def _anthropic_llm(model: str, temperature: float) -> BaseChatModel:
    try:
        from langchain_anthropic import ChatAnthropic
    except ImportError:
        raise ImportError("pip install langchain-anthropic for anthropic provider")
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY required for anthropic LLM provider")
    return ChatAnthropic(model=model, temperature=temperature, api_key=settings.ANTHROPIC_API_KEY)


def _ollama_llm(model: str, temperature: float) -> BaseChatModel:
    try:
        from langchain_ollama import ChatOllama
    except ImportError:
        from langchain_community.chat_models import ChatOllama
    base = settings.OLLAMA_BASE_URL or "http://localhost:11434"
    return ChatOllama(model=model, temperature=temperature, base_url=base)
