"""Composition root: builds every service from settings and owns their lifecycle.

Adapters are imported inside the factory functions so that optional dependencies are
only required for the backends actually configured.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sahayak.config import Settings
from sahayak.domain.ports import (
    Closable,
    FAQRetriever,
    ImageAnalyzer,
    LanguageModel,
    SpeechToText,
    TextToSpeech,
    Warmable,
)
from sahayak.errors import ConfigurationError
from sahayak.services.conversation import ConversationService
from sahayak.services.image_check import ImageCheckService
from sahayak.services.prompting import PromptBuilder
from sahayak.services.retrieval import NullRetriever, RetrievalPolicy, RetrievalService
from sahayak.services.safety import SafetyGuard
from sahayak.services.sessions import SessionStore
from sahayak.services.turns import TurnService

logger = logging.getLogger(__name__)


def build_embedder(settings: Settings) -> Any:
    from sahayak.adapters.embedder_st import SentenceTransformerEmbedder

    r = settings.retrieval
    return SentenceTransformerEmbedder(
        model_name=r.embed_model,
        device=r.embed_device,
        query_prefix=r.query_prefix,
        passage_prefix=r.passage_prefix,
    )


def build_faq_index(settings: Settings, embedder: Any) -> Any:
    from sahayak.adapters.faq_chroma import ChromaFAQIndex

    return ChromaFAQIndex(persist_dir=settings.retrieval.persist_dir, embedder=embedder)


def _build_llm(settings: Settings) -> LanguageModel:
    c = settings.llm
    if c.backend == "echo":
        from sahayak.adapters.llm_echo import EchoLLM

        return EchoLLM()
    from sahayak.adapters.llm_openai import OpenAICompatibleLLM

    return OpenAICompatibleLLM(
        base_url=c.base_url,
        model=c.model,
        temperature=c.temperature,
        max_tokens=c.max_tokens,
        timeout_s=c.timeout_s,
    )


def _build_stt(settings: Settings) -> SpeechToText | None:
    c = settings.stt
    if c.backend == "disabled":
        return None
    if c.backend == "indic_conformer":
        from sahayak.adapters.stt_indic_conformer import IndicConformerSTT

        return IndicConformerSTT(fallback_language=settings.default_language)
    from sahayak.adapters.stt_whisper import FasterWhisperSTT

    return FasterWhisperSTT(
        model_size=c.whisper_model,
        device=c.device,
        compute_type=c.compute_type,
        supported=settings.languages,
    )


def _build_tts(settings: Settings) -> TextToSpeech | None:
    c = settings.tts
    if c.backend == "disabled":
        return None
    if c.backend == "indic_parler":
        from sahayak.adapters.tts_parler import IndicParlerTTS

        return IndicParlerTTS(device=c.device, voice_description=c.voice_description)
    from sahayak.adapters.tts_mms import MMSTTS

    return MMSTTS(
        device=c.device,
        languages=settings.languages,
        voice_pitch=c.voice_pitch,
    )


def _build_image_analyzer(settings: Settings) -> ImageAnalyzer | None:
    c = settings.image_check
    if c.backend == "disabled":
        return None
    if c.backend == "fake":
        from sahayak.adapters.image_fake import FakeImageAnalyzer

        return FakeImageAnalyzer()
    from sahayak.adapters.image_medgemma import OllamaMedGemmaAnalyzer

    return OllamaMedGemmaAnalyzer(
        base_url=c.base_url,
        model=c.model,
        timeout_s=c.timeout_s,
        keep_alive=c.keep_alive,
    )


@dataclass(slots=True)
class Container:
    settings: Settings
    llm: LanguageModel
    retriever: FAQRetriever
    sessions: SessionStore
    turns: TurnService
    _lifecycle: list[object]
    image_check: ImageCheckService | None = None

    async def startup(self) -> None:
        """Load models. Done once at start so the first request is not slow."""
        for component in self._lifecycle:
            if isinstance(component, Warmable):
                await component.load()

    async def shutdown(self) -> None:
        for component in reversed(self._lifecycle):
            if isinstance(component, Closable):
                await component.aclose()

    async def readiness(self) -> dict[str, object]:
        llm_ready = await self.llm.is_ready()
        faq_entries = await self.retriever.size()
        faq_required = self.settings.retrieval.backend != "disabled"
        return {
            "ready": llm_ready and (faq_entries > 0 or not faq_required),
            "llm": llm_ready,
            "faq_entries": faq_entries,
            "voice": self.turns.voice_available,
            "image_check": self.image_check.is_enabled if self.image_check else False,
        }


def build_container(settings: Settings) -> Container:
    llm = _build_llm(settings)
    stt = _build_stt(settings)
    tts = _build_tts(settings)
    image_analyzer = _build_image_analyzer(settings)

    lifecycle: list[object] = []
    if settings.retrieval.backend == "disabled":
        retriever: FAQRetriever = NullRetriever()
    else:
        embedder = build_embedder(settings)
        retriever = build_faq_index(settings, embedder)
        lifecycle += [embedder, retriever]  # the embedder must load before the index is used
    lifecycle += [c for c in (stt, tts, image_analyzer) if c is not None]
    lifecycle.append(llm)

    r = settings.retrieval
    policy = RetrievalPolicy(
        top_k=r.top_k, context_threshold=r.context_threshold, direct_threshold=r.direct_threshold
    )
    try:
        conversation = ConversationService(
            llm=llm,
            retrieval=RetrievalService(retriever, policy),
            safety=SafetyGuard.from_yaml(settings.safety_rules_path),
            prompts=PromptBuilder.from_file(settings.llm.system_prompt_path),
            max_sentence_chars=settings.llm.max_sentence_chars,
        )
    except ValueError as exc:  # invalid policy values
        raise ConfigurationError(str(exc)) from exc

    image_service: ImageCheckService | None = None
    if image_analyzer is not None:
        ic = settings.image_check
        image_service = ImageCheckService(
            analyzer=image_analyzer,
            prompt_path=ic.prompt_path,
            messages_path=ic.messages_path,
            enabled=ic.enabled,
            max_file_size_bytes=ic.max_file_size_bytes,
            max_dimension=ic.max_dimension,
        )

    s = settings.sessions
    return Container(
        settings=settings,
        llm=llm,
        retriever=retriever,
        sessions=SessionStore(
            ttl_s=s.ttl_s, max_sessions=s.max_sessions, max_history_turns=s.max_history_turns
        ),
        turns=TurnService(
            conversation=conversation,
            stt=stt,
            tts=tts,
            default_language=settings.default_language,
        ),
        _lifecycle=lifecycle,
        image_check=image_service,
    )
