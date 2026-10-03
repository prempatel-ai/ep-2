"""Run a conversation turn end to end and report it as a stream of events.

A turn is one user message (spoken or typed) and the assistant's reply. This module is
transport-agnostic: the WebSocket and HTTP layers only serialise the events.

While the model is still generating, finished sentences are synthesised in a second
task, so the first sentence can be heard long before the last one exists.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator, Callable
from contextlib import aclosing
from dataclasses import dataclass

from sahayak.domain.audio import AudioClip
from sahayak.domain.events import (
    AudioReady,
    NoSpeech,
    SentenceReady,
    TranscriptReady,
    TurnEvent,
    TurnFinished,
    TurnMetrics,
)
from sahayak.domain.language import Language
from sahayak.domain.models import AnswerSentence, AnswerSource
from sahayak.domain.ports import SpeechToText, TextToSpeech
from sahayak.errors import InvalidRequestError, VoiceUnavailableError
from sahayak.services.conversation import ConversationService
from sahayak.services.language import detect_language
from sahayak.services.sessions import Session
from sahayak.services.textprep import has_speakable_content, prepare_for_speech

logger = logging.getLogger(__name__)

_DONE = object()


@dataclass(frozen=True, slots=True)
class _Failure:
    error: Exception


class TurnService:
    def __init__(
        self,
        *,
        conversation: ConversationService,
        stt: SpeechToText | None,
        tts: TextToSpeech | None,
        default_language: Language,
        clock: Callable[[], float] = time.perf_counter,
    ) -> None:
        self._conversation = conversation
        self._stt = stt
        self._tts = tts
        self._default_language = default_language
        self._clock = clock

    @property
    def voice_available(self) -> bool:
        return self._stt is not None and self._tts is not None

    async def run_voice_turn(
        self, session: Session, audio: AudioClip, language: Language | None
    ) -> AsyncIterator[TurnEvent]:
        """Transcribe ``audio``, then answer it with text and synthesised speech."""
        if self._stt is None or self._tts is None:
            raise VoiceUnavailableError("Voice is not enabled on this server.")

        started = self._clock()
        transcript = await self._stt.transcribe(audio, language)
        stt_ms = self._elapsed_ms(started)

        text = transcript.text.strip()
        if not text:
            yield NoSpeech()
            return

        resolved = language or transcript.language or detect_language(text, self._default_language)
        yield TranscriptReady(text=text, language=resolved)

        async with aclosing(
            self._answer(session, text, resolved, speak=True, started=started, stt_ms=stt_ms)
        ) as events:
            async for event in events:
                yield event

    async def run_text_turn(
        self,
        session: Session,
        text: str,
        language: Language | None,
        *,
        speak: bool = False,
    ) -> AsyncIterator[TurnEvent]:
        """Answer typed text, optionally with synthesised speech."""
        cleaned = text.strip()
        if not cleaned:
            raise InvalidRequestError("Message text is empty.")
        if speak and not self.voice_available:
            raise VoiceUnavailableError("Voice is not enabled on this server.")

        resolved = language or detect_language(cleaned, self._default_language)
        async with aclosing(
            self._answer(
                session, cleaned, resolved, speak=speak, started=self._clock(), stt_ms=None
            )
        ) as events:
            async for event in events:
                yield event

    async def _answer(
        self,
        session: Session,
        text: str,
        language: Language,
        *,
        speak: bool,
        started: float,
        stt_ms: float | None,
    ) -> AsyncIterator[TurnEvent]:
        out: asyncio.Queue[object] = asyncio.Queue()
        synth_queue: asyncio.Queue[AnswerSentence | None] | None = asyncio.Queue() if speak else None

        tasks = [
            asyncio.create_task(
                self._produce(out, synth_queue, session, text, language), name="answer-producer"
            )
        ]
        if synth_queue is not None:
            tasks.append(
                asyncio.create_task(self._synthesise(out, synth_queue, language), name="synthesiser")
            )

        source: AnswerSource | None = None
        first_sentence_ms: float | None = None
        first_audio_ms: float | None = None
        try:
            while True:
                item = await out.get()
                if item is _DONE:
                    break
                if isinstance(item, _Failure):
                    raise item.error
                if isinstance(item, SentenceReady):
                    source = source or item.sentence.source
                    if first_sentence_ms is None:
                        first_sentence_ms = self._elapsed_ms(started)
                elif isinstance(item, AudioReady) and first_audio_ms is None:
                    first_audio_ms = self._elapsed_ms(started)
                yield item  # type: ignore[misc]  # queue items are TurnEvents by construction

            metrics = TurnMetrics(
                stt_ms=stt_ms,
                first_sentence_ms=first_sentence_ms,
                first_audio_ms=first_audio_ms,
                total_ms=self._elapsed_ms(started),
            )
            logger.info(
                "turn finished source=%s stt_ms=%s first_sentence_ms=%s first_audio_ms=%s "
                "total_ms=%.0f",
                source,
                _fmt(metrics.stt_ms),
                _fmt(metrics.first_sentence_ms),
                _fmt(metrics.first_audio_ms),
                metrics.total_ms,
            )
            yield TurnFinished(source=source, metrics=metrics)
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _produce(
        self,
        out: asyncio.Queue[object],
        synth_queue: asyncio.Queue[AnswerSentence | None] | None,
        session: Session,
        text: str,
        language: Language,
    ) -> None:
        try:
            async with aclosing(self._conversation.respond(session, text, language)) as stream:
                async for sentence in stream:
                    out.put_nowait(SentenceReady(sentence))
                    if synth_queue is not None:
                        synth_queue.put_nowait(sentence)
        except Exception as exc:
            out.put_nowait(_Failure(exc))
        finally:
            if synth_queue is not None:
                synth_queue.put_nowait(None)  # tells the synthesiser to finish
            else:
                out.put_nowait(_DONE)

    async def _synthesise(
        self,
        out: asyncio.Queue[object],
        synth_queue: asyncio.Queue[AnswerSentence | None],
        language: Language,
    ) -> None:
        assert self._tts is not None  # guaranteed by the callers' voice_available checks
        try:
            while (sentence := await synth_queue.get()) is not None:
                speakable = prepare_for_speech(sentence.text)
                if not has_speakable_content(speakable):
                    continue
                clip = await self._tts.synthesize(speakable, language)
                out.put_nowait(AudioReady(index=sentence.index, clip=clip))
        except Exception as exc:
            out.put_nowait(_Failure(exc))
        finally:
            out.put_nowait(_DONE)

    def _elapsed_ms(self, started: float) -> float:
        return (self._clock() - started) * 1000.0


def _fmt(value: float | None) -> str:
    return "-" if value is None else f"{value:.0f}"
