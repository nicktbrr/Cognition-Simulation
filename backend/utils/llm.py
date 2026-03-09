"""
LangChain LLM factory for multi-model support.

Provides a unified interface for creating LLM instances and invoking
structured outputs with token usage tracking.
"""

import os
from typing import Any, Dict, List, Tuple, Type

from pydantic import BaseModel


class BaseResponse(BaseModel):
    """Structured response for simulation steps."""
    type: List[str] = []
    response: str = ""


class EvaluationMetrics(BaseModel):
    """Structured response for evaluation metrics."""
    metric: List[str]
    score: List[float]


# Maps short/friendly names (sent from the frontend) to canonical API model IDs.
MODEL_NAME_MAP: Dict[str, str] = {
    "gemini": "gemini-2.0-flash",
    "gemini-flash": "gemini-2.0-flash",
    "gemini-2.0": "gemini-2.0-flash",
    # Future entries:
    # "gpt4o": "gpt-4o",
    # "claude": "claude-3-5-sonnet-20241022",
}

DEFAULT_MODEL = "gemini-2.0-flash"


def resolve_model_name(model_name: str) -> str:
    """Normalize a model name to a canonical API model ID."""
    if not model_name:
        return DEFAULT_MODEL
    return MODEL_NAME_MAP.get(model_name, model_name)


def get_llm(model_name: str, temperature: float = 0.0):
    """
    Create a LangChain chat model instance for the given model name.

    Args:
        model_name: Model identifier or short name (e.g. "gemini", "gemini-2.0-flash")
        temperature: Sampling temperature (0.0 – 1.0)

    Returns:
        LangChain BaseChatModel instance
    """
    model_name = resolve_model_name(model_name)

    if model_name.startswith("gemini"):
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            google_api_key=os.environ.get("GEMINI_KEY"),
        )
    # Future model support:
    # elif model_name.startswith("gpt"):
    #     from langchain_openai import ChatOpenAI
    #     return ChatOpenAI(model=model_name, temperature=temperature)
    # elif model_name.startswith("claude"):
    #     from langchain_anthropic import ChatAnthropic
    #     return ChatAnthropic(model=model_name, temperature=temperature)
    raise ValueError(f"Unsupported model: {model_name}")


def _extract_usage(raw_message) -> Dict[str, int]:
    """Extract token usage from a LangChain AIMessage."""
    usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    if raw_message and hasattr(raw_message, "usage_metadata") and raw_message.usage_metadata:
        meta = raw_message.usage_metadata
        usage["input_tokens"] = meta.get("input_tokens", 0) or 0
        usage["output_tokens"] = meta.get("output_tokens", 0) or 0
        usage["total_tokens"] = meta.get("total_tokens", 0) or 0
    return usage


def invoke_structured(
    model_name: str,
    schema: Type[BaseModel],
    messages: List,
    temperature: float = 0.0,
) -> Tuple[Any, Dict[str, int]]:
    """
    Invoke an LLM with structured output and return (parsed_result, usage_dict).

    Args:
        model_name: Model identifier
        schema: Pydantic model class for structured output
        messages: List of LangChain message objects (SystemMessage, HumanMessage, etc.)
        temperature: Sampling temperature

    Returns:
        (parsed, usage) where:
            - parsed is the validated Pydantic object (or None on parse failure)
            - usage has keys: input_tokens, output_tokens, total_tokens
    """
    llm = get_llm(model_name, temperature)
    structured_llm = llm.with_structured_output(schema, include_raw=True)
    result = structured_llm.invoke(messages)

    parsed = result.get("parsed")
    raw = result.get("raw")
    usage = _extract_usage(raw)

    return parsed, usage
