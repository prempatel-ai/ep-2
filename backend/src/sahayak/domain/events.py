"""Events emitted while a conversation turn is processed.

They are transport-agnostic: the WebSocket and SSE layers only serialise them.
"""

from __future__ import annotations

from dataclasses import dataclass

from sahayak.domain.audio import AudioClip
from sahayak.domain.language import Language
from sahayak.domain.models import AnswerSentence, AnswerSource


@dataclass(frozen=True, slots=True)
class TurnMetrics:
    """Latencies in milliseconds, measured from the start of the turn."""

    stt_ms: float | None
    first_sentence_ms: float | None
    first_audio_ms: float | None
    total_ms: float


@dataclass(frozen=True, slots=True)
class TranscriptReady:
    text: str
    language: Language


@dataclass(frozen=True, slots=True)
class NoSpeech:
    """The audio contained no recognisable speech."""


@dataclass(frozen=True, slots=True)
class SentenceReady:
    sentence: AnswerSentence


@dataclass(frozen=True, slots=True)
class AudioReady:
    index: int  # matches AnswerSentence.index
    clip: AudioClip


@dataclass(frozen=True, slots=True)
class TurnFinished:
    source: AnswerSource | None
    metrics: TurnMetrics


TurnEvent = TranscriptReady | NoSpeech | SentenceReady | AudioReady | TurnFinished
