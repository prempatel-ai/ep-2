"""Speech-to-text with faster-whisper."""

from __future__ import annotations

import logging
from collections.abc import Sequence

import numpy as np

from sahayak.core.blocking import BlockingRunner
from sahayak.domain.audio import AudioClip
from sahayak.domain.language import Language
from sahayak.domain.models import Transcript
from sahayak.errors import SpeechRecognitionError

logger = logging.getLogger(__name__)

_WHISPER_RATE = 16_000


class FasterWhisperSTT:
    """Whisper is weakest on Gujarati. Pass the user's language whenever it is known;
    when it is not, detection is restricted to the languages the assistant supports."""

    def __init__(
        self,
        *,
        model_size: str,
        device: str,
        compute_type: str,
        supported: Sequence[Language],
    ) -> None:
        self._model_size = model_size
        self._device = device
        self._compute_type = compute_type
        self._supported = tuple(supported)
        self._runner = BlockingRunner("whisper")
        self._model = None

    async def load(self) -> None:
        await self._runner.run(self._load_model)

    def _load_model(self) -> None:
        from faster_whisper import WhisperModel

        self._model = WhisperModel(
            self._model_size, device=self._device, compute_type=self._compute_type
        )
        logger.info("loaded Whisper model %s on %s", self._model_size, self._device)

    async def transcribe(self, audio: AudioClip, language: Language | None) -> Transcript:
        if audio.sample_rate != _WHISPER_RATE:
            raise SpeechRecognitionError(f"Whisper expects {_WHISPER_RATE} Hz audio.")
        try:
            return await self._runner.run(self._transcribe, audio.samples, language)
        except SpeechRecognitionError:
            raise
        except Exception as exc:
            raise SpeechRecognitionError("Speech recognition failed.") from exc

    def _transcribe(self, samples: np.ndarray, language: Language | None) -> Transcript:
        assert self._model is not None, "load() must be called first"
        segments, info = self._model.transcribe(
            samples, language=language.value if language else None, beam_size=1
        )
        detected = Language.parse(info.language)

        if language is None and detected is None:
            # Detected an unsupported language: retry with the likeliest supported one.
            probabilities = dict(getattr(info, "all_language_probs", None) or [])
            candidates = [(probabilities.get(lang.value, 0.0), lang) for lang in self._supported]
            if candidates:
                detected = max(candidates, key=lambda c: c[0])[1]
                segments, _ = self._model.transcribe(samples, language=detected.value, beam_size=1)

        text = " ".join(segment.text.strip() for segment in segments).strip()
        return Transcript(text=text, language=language or detected)
