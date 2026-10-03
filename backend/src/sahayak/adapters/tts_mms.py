"""Text-to-speech with Meta MMS-TTS (VITS). Small and fast, but audibly synthetic."""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence

import numpy as np

from sahayak.core.blocking import BlockingRunner
from sahayak.domain.audio import AudioClip
from sahayak.domain.language import Language
from sahayak.errors import SpeechSynthesisError

logger = logging.getLogger(__name__)

_MODEL_IDS: Mapping[Language, str] = {
    Language.GUJARATI: "facebook/mms-tts-guj",
    Language.HINDI: "facebook/mms-tts-hin",
    Language.ENGLISH: "facebook/mms-tts-eng",
}


class MMSTTS:
    def __init__(self, *, device: str, languages: Sequence[Language]) -> None:
        self._device = device
        self._languages = tuple(languages)
        self._runner = BlockingRunner("mms-tts")
        self._models: dict[Language, tuple[object, object]] = {}

    async def load(self) -> None:
        await self._runner.run(self._load_all)

    def _load_all(self) -> None:
        from transformers import AutoTokenizer, VitsModel

        for language in self._languages:
            model_id = _MODEL_IDS[language]
            tokenizer = AutoTokenizer.from_pretrained(model_id)
            model = VitsModel.from_pretrained(model_id).to(self._device).eval()
            self._models[language] = (tokenizer, model)
            logger.info("loaded %s", model_id)

    async def synthesize(self, text: str, language: Language) -> AudioClip:
        if language not in self._models:
            raise SpeechSynthesisError(f"No voice is loaded for '{language.value}'.")
        try:
            return await self._runner.run(self._synthesize, text, language)
        except Exception as exc:
            raise SpeechSynthesisError("Speech synthesis failed.") from exc

    def _synthesize(self, text: str, language: Language) -> AudioClip:
        import torch

        tokenizer, model = self._models[language]
        inputs = tokenizer(text, return_tensors="pt").to(self._device)  # type: ignore[attr-defined]
        with torch.no_grad():
            waveform = model(**inputs).waveform[0]  # type: ignore[operator]
        samples = waveform.cpu().numpy().astype(np.float32)
        return AudioClip(samples, int(model.config.sampling_rate))  # type: ignore[attr-defined]
