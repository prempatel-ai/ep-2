"""Audio value type and PCM/WAV conversion helpers."""

from __future__ import annotations

import io
import wave
from dataclasses import dataclass

import numpy as np

from sahayak.errors import InvalidAudioError

_PCM16_SCALE = 32768.0


@dataclass(frozen=True, slots=True, eq=False)
class AudioClip:
    """Mono audio as float32 samples in [-1, 1]."""

    samples: np.ndarray
    sample_rate: int

    def __post_init__(self) -> None:
        if self.samples.ndim != 1:
            raise ValueError("AudioClip samples must be a 1-D (mono) array")
        if self.sample_rate <= 0:
            raise ValueError("AudioClip sample_rate must be positive")

    @property
    def duration_s(self) -> float:
        return len(self.samples) / self.sample_rate

    def to_wav_bytes(self) -> bytes:
        """Encode as a 16-bit mono WAV file (browser-decodable)."""
        pcm = (np.clip(self.samples, -1.0, 1.0) * 32767.0).astype("<i2")
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(self.sample_rate)
            wav.writeframes(pcm.tobytes())
        return buffer.getvalue()


def clip_from_pcm16(data: bytes, sample_rate: int) -> AudioClip:
    """Decode little-endian signed 16-bit mono PCM."""
    if not data:
        raise InvalidAudioError("Audio is empty.")
    if len(data) % 2:
        raise InvalidAudioError("PCM16 audio must contain an even number of bytes.")
    samples = np.frombuffer(data, dtype="<i2").astype(np.float32) / _PCM16_SCALE
    return AudioClip(samples=samples, sample_rate=sample_rate)
