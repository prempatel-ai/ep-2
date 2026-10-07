"""Speech-to-text with faster-whisper."""

from __future__ import annotations

import logging
import re
from collections.abc import Sequence

import numpy as np

from sahayak.core.blocking import BlockingRunner
from sahayak.domain.audio import AudioClip
from sahayak.domain.language import Language
from sahayak.domain.models import Transcript
from sahayak.errors import SpeechRecognitionError

logger = logging.getLogger(__name__)

_WHISPER_RATE = 16_000

_DEFAULT_INITIAL_PROMPT = (
    "Sahayak conversational healthcare assistant. Patient conversation in English, Gujarati, or Hindi. "
    "Topics: my name is Prem, doctor consultation, symptoms, medications, appointment, health queries."
)

_HALLUCINATION_PATTERNS = {
    "i love you",
    "i love you so much",
    "thank you for watching",
    "thank you for watching this video",
    "thanks for watching",
    "thanks for watching this video",
    "please subscribe",
    "subscribe to my channel",
    "subtitles by",
    "translated by",
    "see you next time",
    "see you later",
    "bye bye",
    "you",
    "bye",
    "goodbye",
}


def _is_hallucination(text: str) -> bool:
    cleaned = re.sub(r"[^\w\s]", "", text.strip().lower()).strip()
    return cleaned in _HALLUCINATION_PATTERNS


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
        initial_prompt: str = _DEFAULT_INITIAL_PROMPT,
    ) -> None:
        self._model_size = model_size
        self._device = device
        self._compute_type = compute_type
        self._supported = tuple(supported)
        self._initial_prompt = initial_prompt
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

        # Peak normalize faint audio so Whisper's mel filterbanks have clear SNR
        peak = float(np.max(np.abs(samples))) if len(samples) > 0 else 0.0
        if 0.005 < peak < 0.6:
            samples = samples * (0.8 / peak)

        transcribe_opts = {
            "beam_size": 5,
            "condition_on_previous_text": False,
            "vad_filter": True,
            "vad_parameters": {"min_silence_duration_ms": 400},
            "no_speech_threshold": 0.6,
            "initial_prompt": self._initial_prompt,
        }

        segments, info = self._model.transcribe(
            samples,
            language=language.value if language else None,
            **transcribe_opts,
        )
        detected = Language.parse(info.language)

        if language is None and detected is None:
            # Detected an unsupported language: retry with the likeliest supported one.
            probabilities = dict(getattr(info, "all_language_probs", None) or [])
            candidates = [(probabilities.get(lang.value, 0.0), lang) for lang in self._supported]
            if candidates:
                detected = max(candidates, key=lambda c: c[0])[1]
                segments, _ = self._model.transcribe(
                    samples,
                    language=detected.value,
                    **transcribe_opts,
                )

        segment_list = list(segments)
        valid_segments = [s for s in segment_list if s.no_speech_prob < 0.8 and s.text.strip()]
        text = " ".join(s.text.strip() for s in valid_segments).strip()

        if _is_hallucination(text):
            logger.warning("Suppressed Whisper hallucination: %r", text)
            text = ""

        return Transcript(text=text, language=language or detected)
