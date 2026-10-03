"""Turn events to wire format. Pure functions, shared by the WebSocket and SSE routes."""

from __future__ import annotations

import json
import struct
from typing import Any

from sahayak.domain.audio import AudioClip
from sahayak.domain.events import (
    AudioReady,
    NoSpeech,
    SentenceReady,
    TranscriptReady,
    TurnEvent,
    TurnFinished,
)
from sahayak.errors import SahayakError

_AUDIO_HEADER = struct.Struct(">I")


def serialize_event(event: TurnEvent) -> dict[str, Any]:
    """JSON-ready dict for any event except ``AudioReady`` (audio is sent as binary)."""
    match event:
        case TranscriptReady(text=text, language=language):
            return {"type": "transcript", "text": text, "language": language.value}
        case NoSpeech():
            return {"type": "no_speech"}
        case SentenceReady(sentence=s):
            return {"type": "sentence", "index": s.index, "text": s.text, "source": s.source.value}
        case TurnFinished(source=source, metrics=m):
            return {
                "type": "done",
                "source": source.value if source else None,
                "metrics": {
                    "stt_ms": m.stt_ms,
                    "first_sentence_ms": m.first_sentence_ms,
                    "first_audio_ms": m.first_audio_ms,
                    "total_ms": m.total_ms,
                },
            }
        case AudioReady():
            raise TypeError("AudioReady is sent as a binary frame; use encode_audio_frame")
    raise TypeError(f"Unknown event type: {type(event).__name__}")


def encode_audio_frame(index: int, clip: AudioClip) -> bytes:
    """Binary WebSocket frame: 4-byte big-endian sentence index, then a WAV file."""
    return _AUDIO_HEADER.pack(index) + clip.to_wav_bytes()


def decode_audio_frame(frame: bytes) -> tuple[int, bytes]:
    (index,) = _AUDIO_HEADER.unpack_from(frame)
    return index, frame[_AUDIO_HEADER.size :]


def error_payload(error: SahayakError) -> dict[str, Any]:
    return {"type": "error", "code": error.code, "message": error.message}


def sse_frame(payload: dict[str, Any]) -> str:
    """One server-sent event; the event name is the payload's ``type``."""
    data = json.dumps(payload, ensure_ascii=False)
    return f"event: {payload['type']}\ndata: {data}\n\n"
