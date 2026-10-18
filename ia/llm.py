from functools import lru_cache

from django.conf import settings
from langchain_groq import ChatGroq


@lru_cache(maxsize=1)
def get_llm() -> ChatGroq:
    if not settings.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY manquante")
    return ChatGroq(
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.2,
        max_retries=2,
        timeout=30,
    )