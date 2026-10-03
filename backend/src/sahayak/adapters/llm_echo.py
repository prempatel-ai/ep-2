"""A stand-in language model for developing the UI and the pipeline without a model."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Sequence

from sahayak.domain.models import ChatMessage

_REPLY = (
    "This is a placeholder reply from the development model. "
    "Your real fine-tuned model will answer here once it is connected. "
    "You asked: {question}"
)


class EchoLLM:
    def __init__(self, delay_s: float = 0.02) -> None:
        self._delay_s = delay_s

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        question = next((m.content for m in reversed(messages) if m.role == "user"), "")
        for word in _REPLY.format(question=question).split(" "):
            await asyncio.sleep(self._delay_s)
            yield word + " "

    async def is_ready(self) -> bool:
        return True
