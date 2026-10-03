"""Text-to-speech with AI4Bharat Indic Parler-TTS: more natural, but much heavier.

Check the model card for the current usage before relying on this adapter.
"""

from __future__ import annotations

import logging

import numpy as np

from sahayak.core.blocking import BlockingRunner
from sahayak.domain.audio import AudioClip
from sahayak.domain.language import Language
from sahayak.errors import SpeechSynthesisError

logger = logging.getLogger(__name__)

_MODEL_ID = "ai4bharat/indic-parler-tts"


class IndicParlerTTS:
    """The ``voice_description`` is free text that steers the speaker, pace and tone."""

    def __init__(self, *, device: str, voice_description: str) -> None:
        self._device = device
        self._description = voice_description
        self._runner = BlockingRunner("parler-tts")
        self._model = None
        self._prompt_tokenizer = None
        self._description_tokenizer = None

    async def load(self) -> None:
        await self._runner.run(self._load_model)

    def _load_model(self) -> None:
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        self._model = ParlerTTSForConditionalGeneration.from_pretrained(_MODEL_ID).to(self._device)
        self._prompt_tokenizer = AutoTokenizer.from_pretrained(_MODEL_ID)
        self._description_tokenizer = AutoTokenizer.from_pretrained(
            self._model.config.text_encoder._name_or_path
        )
        logger.info("loaded %s", _MODEL_ID)

    async def synthesize(self, text: str, language: Language) -> AudioClip:
        try:
            return await self._runner.run(self._synthesize, text)
        except Exception as exc:
            raise SpeechSynthesisError("Speech synthesis failed.") from exc

    def _synthesize(self, text: str) -> AudioClip:
        assert self._model is not None, "load() must be called first"
        description = self._description_tokenizer(self._description, return_tensors="pt").to(  # type: ignore[misc]
            self._device
        )
        prompt = self._prompt_tokenizer(text, return_tensors="pt").to(self._device)  # type: ignore[misc]
        generated = self._model.generate(
            input_ids=description.input_ids,
            attention_mask=description.attention_mask,
            prompt_input_ids=prompt.input_ids,
            prompt_attention_mask=prompt.attention_mask,
        )
        samples = generated.cpu().numpy().squeeze().astype(np.float32)
        return AudioClip(samples, int(self._model.config.sampling_rate))
