"""Interfaces the services depend on.

Adapters (llama.cpp, Whisper, Chroma, ...) implement these; services never import
an adapter, which keeps every model swappable and every service testable.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from typing import Protocol, runtime_checkable

from sahayak.domain.audio import AudioClip
from sahayak.domain.image import ImageAnalysisResult
from sahayak.domain.language import Language
from sahayak.domain.models import ChatMessage, FAQEntry, FAQHit, Transcript


@runtime_checkable
class Warmable(Protocol):
    """Adapters with expensive start-up (model loading) implement this."""

    async def load(self) -> None: ...


@runtime_checkable
class Closable(Protocol):
    async def aclose(self) -> None: ...


class LanguageModel(Protocol):
    def stream(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        """Yield the reply as text fragments as they are generated."""
        ...

    async def is_ready(self) -> bool: ...


class SpeechToText(Protocol):
    async def transcribe(self, audio: AudioClip, language: Language | None) -> Transcript: ...


class TextToSpeech(Protocol):
    async def synthesize(self, text: str, language: Language) -> AudioClip: ...


class Embedder(Protocol):
    async def embed_queries(self, texts: Sequence[str]) -> list[list[float]]: ...

    async def embed_passages(self, texts: Sequence[str]) -> list[list[float]]: ...


class FAQRetriever(Protocol):
    async def search(self, query: str, limit: int) -> list[FAQHit]: ...

    async def size(self) -> int: ...


class FAQIndex(FAQRetriever, Protocol):
    async def rebuild(self, entries: Sequence[FAQEntry], batch_size: int = 256) -> None: ...


class ImageAnalyzer(Protocol):
    """Port for multimodal image observation models."""

    async def analyze(self, image_bytes: bytes, prompt: str) -> ImageAnalysisResult:
        """Analyze an in-memory image and return structured categories."""
        ...

    async def is_ready(self) -> bool:
        ...

