"""Language model served over an OpenAI-compatible HTTP API.

``llama-server`` (llama.cpp), vLLM and Ollama all expose this API, so swapping the
model, or the server that runs it, is a configuration change.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Sequence

import httpx

from sahayak.adapters.openai_sse import DONE, parse_stream_line
from sahayak.domain.models import ChatMessage
from sahayak.errors import LanguageModelUnavailableError

logger = logging.getLogger(__name__)


class OpenAICompatibleLLM:
    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        temperature: float,
        max_tokens: int,
        timeout_s: float,
    ) -> None:
        self._model = model
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=httpx.Timeout(timeout_s, connect=5.0),
        )

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        payload = {
            "model": self._model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": self._temperature,
            "max_tokens": self._max_tokens,
            "stream": True,
        }
        try:
            async with self._client.stream("POST", "/chat/completions", json=payload) as response:
                if response.status_code != 200:
                    body = (await response.aread()).decode("utf-8", errors="replace")[:200]
                    raise LanguageModelUnavailableError(
                        f"Language model server returned HTTP {response.status_code}: {body}"
                    )
                async for line in response.aiter_lines():
                    parsed = parse_stream_line(line)
                    if parsed is DONE:
                        return
                    if isinstance(parsed, str):
                        yield parsed
        except httpx.HTTPError as exc:
            logger.warning("language model request failed: %s", exc)
            raise LanguageModelUnavailableError(
                "The language model server is not reachable."
            ) from exc

    async def is_ready(self) -> bool:
        try:
            response = await self._client.get("/models", timeout=3.0)
        except httpx.HTTPError:
            return False
        return response.status_code == 200

    async def aclose(self) -> None:
        await self._client.aclose()
