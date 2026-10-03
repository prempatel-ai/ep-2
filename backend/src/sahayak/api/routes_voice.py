"""Voice conversation over a WebSocket.

Protocol (see README for the full description)
  client -> server, text:   {"type":"start","session_id"?,"language"?}
                            {"type":"text","text":"...","speak":true}
                            {"type":"interrupt"}
  client -> server, binary: one complete utterance as 16 kHz mono signed 16-bit PCM
  server -> client, text:   ready | transcript | sentence | no_speech | done |
                            interrupted | error
  server -> client, binary: 4-byte big-endian sentence index + WAV audio

The client detects when the user starts and stops speaking and sends one binary frame
per utterance. Sending a new utterance, a text message, or ``interrupt`` cancels the
reply in progress, which is what makes barge-in feel immediate.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import aclosing

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from sahayak.api.schemas import CLIENT_MESSAGE, InterruptMessage, StartMessage, TextMessage
from sahayak.api.serialization import encode_audio_frame, error_payload, serialize_event
from sahayak.container import Container
from sahayak.domain.audio import clip_from_pcm16
from sahayak.domain.events import AudioReady, TurnEvent
from sahayak.domain.language import Language
from sahayak.errors import InvalidAudioError, InvalidRequestError, SahayakError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1")


@router.websocket("/voice")
async def voice(websocket: WebSocket) -> None:
    container: Container = websocket.app.state.container
    await _VoiceConnection(websocket, container).run()


class _VoiceConnection:
    def __init__(self, websocket: WebSocket, container: Container) -> None:
        self._ws = websocket
        self._container = container
        self._session = container.sessions.get_or_create()
        self._language: Language | None = None
        self._turn: asyncio.Task[None] | None = None
        self._send_lock = asyncio.Lock()

        audio = container.settings.audio
        self._sample_rate = audio.input_sample_rate
        self._max_bytes = int(audio.max_utterance_s * self._sample_rate) * 2
        self._min_ms = audio.min_utterance_ms

    async def run(self) -> None:
        await self._ws.accept()
        try:
            await self._send_json(self._ready_payload())
            await self._receive_loop()
        except WebSocketDisconnect:
            pass
        finally:
            await self._cancel_turn()

    def _ready_payload(self) -> dict[str, object]:
        return {
            "type": "ready",
            "session_id": self._session.id,
            "voice": self._container.turns.voice_available,
            "input_sample_rate": self._sample_rate,
        }

    async def _receive_loop(self) -> None:
        while True:
            message = await self._ws.receive()
            if message["type"] == "websocket.disconnect":
                return
            try:
                if (data := message.get("bytes")) is not None:
                    await self._on_audio(data)
                elif (raw := message.get("text")) is not None:
                    await self._on_message(raw)
            except SahayakError as exc:
                await self._send_json(error_payload(exc))

    async def _on_message(self, raw: str) -> None:
        try:
            message = CLIENT_MESSAGE.validate_json(raw)
        except ValidationError as exc:
            raise InvalidRequestError(f"Invalid message: {exc.errors()[0]['msg']}") from exc

        match message:
            case StartMessage(session_id=session_id, language=language):
                await self._cancel_turn()
                if session_id is not None:
                    self._session = self._container.sessions.get_or_create(session_id)
                self._language = language
                await self._send_json(self._ready_payload())
            case TextMessage(text=text, speak=speak):
                await self._start_turn(
                    self._container.turns.run_text_turn(
                        self._session, text, self._language, speak=speak
                    )
                )
            case InterruptMessage():
                if await self._cancel_turn():
                    await self._send_json({"type": "interrupted"})

    async def _on_audio(self, data: bytes) -> None:
        if len(data) > self._max_bytes:
            raise InvalidAudioError("Utterance is too long.")
        clip = clip_from_pcm16(data, self._sample_rate)
        if clip.duration_s * 1000 < self._min_ms:
            await self._cancel_turn()
            await self._send_json({"type": "no_speech"})
            return
        await self._start_turn(
            self._container.turns.run_voice_turn(self._session, clip, self._language)
        )

    async def _start_turn(self, events: AsyncIterator[TurnEvent]) -> None:
        """Begin a new reply, cancelling any reply still in progress (barge-in)."""
        await self._cancel_turn()
        self._turn = asyncio.create_task(self._pump(events), name="voice-turn")

    async def _pump(self, events: AsyncIterator[TurnEvent]) -> None:
        try:
            async with aclosing(events) as stream:
                async for event in stream:
                    if isinstance(event, AudioReady):
                        await self._send_bytes(encode_audio_frame(event.index, event.clip))
                    else:
                        await self._send_json(serialize_event(event))
        except SahayakError as exc:
            await self._send_json(error_payload(exc))
        except (WebSocketDisconnect, RuntimeError):
            logger.debug("client went away during a turn")
        except Exception:
            logger.exception("voice turn failed")
            await self._send_json(error_payload(SahayakError("Something went wrong.")))

    async def _cancel_turn(self) -> bool:
        """Stop the reply in progress. Returns True if there was one."""
        turn, self._turn = self._turn, None
        if turn is None or turn.done():
            return False
        turn.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await turn
        return True

    async def _send_json(self, payload: dict[str, object]) -> None:
        async with self._send_lock:
            with contextlib.suppress(WebSocketDisconnect, RuntimeError):
                await self._ws.send_json(payload)

    async def _send_bytes(self, payload: bytes) -> None:
        async with self._send_lock:
            await self._ws.send_bytes(payload)
