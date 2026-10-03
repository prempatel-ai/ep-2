"""Test doubles for the ports."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Sequence

import numpy as np

from sahayak.domain.audio import AudioClip
from sahayak.domain.language import Language
from sahayak.domain.models import ChatMessage, FAQHit, Transcript


def tone(duration_s: float = 0.1, sample_rate: int = 16000) -> AudioClip:
    t = np.linspace(0, duration_s, int(duration_s * sample_rate), endpoint=False)
    return AudioClip((0.2 * np.sin(2 * np.pi * 220 * t)).astype(np.float32), sample_rate)


class FakeLLM:
    def __init__(self, fragments: Sequence[str] = (), *, fail_with: Exception | None = None):
        self.fragments = list(fragments)
        self.fail_with = fail_with
        self.calls: list[list[ChatMessage]] = []
        self.closed = False

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        self.calls.append(list(messages))
        try:
            for fragment in self.fragments:
                await asyncio.sleep(0)
                yield fragment
            if self.fail_with is not None:
                raise self.fail_with
        finally:
            self.closed = True

    async def is_ready(self) -> bool:
        return True


class StallingLLM:
    """Yields one fragment, then waits forever (for cancellation tests)."""

    def __init__(self) -> None:
        self.cancelled = False

    async def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        try:
            yield "First sentence. "
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            self.cancelled = True
            raise

    async def is_ready(self) -> bool:
        return True


class FakeRetriever:
    def __init__(self, hits: Sequence[FAQHit] = (), *, fail: bool = False):
        self.hits = list(hits)
        self.fail = fail
        self.queries: list[str] = []

    async def search(self, query: str, limit: int) -> list[FAQHit]:
        self.queries.append(query)
        if self.fail:
            raise RuntimeError("index offline")
        return self.hits[:limit]

    async def size(self) -> int:
        return len(self.hits)


class FakeSTT:
    def __init__(self, text: str = "what is a mammogram?", language: Language | None = None):
        self.transcript = Transcript(text, language)
        self.calls: list[Language | None] = []

    async def transcribe(self, audio: AudioClip, language: Language | None) -> Transcript:
        self.calls.append(language)
        return self.transcript


class FakeTTS:
    def __init__(self, *, fail_on: str | None = None):
        self.spoken: list[tuple[str, Language]] = []
        self.fail_on = fail_on

    async def synthesize(self, text: str, language: Language) -> AudioClip:
        if self.fail_on and self.fail_on in text:
            raise RuntimeError("synthesis failed")
        self.spoken.append((text, language))
        return tone(0.05)
