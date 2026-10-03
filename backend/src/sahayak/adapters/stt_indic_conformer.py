"""Speech-to-text with AI4Bharat's IndicConformer.

Verify the call signature against the model card before relying on this adapter:
the model ships custom code (``trust_remote_code``) and its interface can change.
"""

from __future__ import annotations

import logging

from sahayak.core.blocking import BlockingRunner
from sahayak.domain.audio import AudioClip
from sahayak.domain.language import Language
from sahayak.domain.models import Transcript
from sahayak.errors import SpeechRecognitionError

logger = logging.getLogger(__name__)

_MODEL_ID = "ai4bharat/indic-conformer-600m-multilingual"
_RATE = 16_000


class IndicConformerSTT:
    """Needs the language up front. When the client does not state one, it falls back
    to ``fallback_language`` (the deployment's default)."""

    def __init__(self, *, fallback_language: Language, decoder: str = "rnnt") -> None:
        self._fallback = fallback_language
        self._decoder = decoder
        self._runner = BlockingRunner("indic-conformer")
        self._model = None

    async def load(self) -> None:
        await self._runner.run(self._load_model)

    def _load_model(self) -> None:
        from transformers import AutoModel

        self._model = AutoModel.from_pretrained(_MODEL_ID, trust_remote_code=True)
        logger.info("loaded %s", _MODEL_ID)

    async def transcribe(self, audio: AudioClip, language: Language | None) -> Transcript:
        if audio.sample_rate != _RATE:
            raise SpeechRecognitionError(f"IndicConformer expects {_RATE} Hz audio.")
        chosen = language or self._fallback
        try:
            text = await self._runner.run(self._transcribe, audio, chosen)
        except Exception as exc:
            raise SpeechRecognitionError("Speech recognition failed.") from exc
        return Transcript(text=text.strip(), language=chosen)

    def _transcribe(self, audio: AudioClip, language: Language) -> str:
        import torch

        assert self._model is not None, "load() must be called first"
        waveform = torch.from_numpy(audio.samples).unsqueeze(0)
        return str(self._model(waveform, language.value, self._decoder))
