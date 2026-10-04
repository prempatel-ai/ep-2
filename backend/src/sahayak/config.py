"""Application settings.

Values come from environment variables prefixed ``SAHAYAK_`` (nested keys use ``__``,
e.g. ``SAHAYAK_LLM__BASE_URL``) or from a ``.env`` file. See ``.env.example``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from sahayak.domain.language import Language

RESOURCES_DIR = Path(__file__).parent / "resources"


class LLMSettings(BaseModel):
    # "echo" is a placeholder model for building the UI before the real one exists.
    backend: Literal["openai_compatible", "echo"] = "openai_compatible"
    base_url: str = "http://127.0.0.1:8080/v1"
    model: str = "local"
    temperature: float = Field(0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(300, ge=16, le=2048)
    timeout_s: float = Field(60.0, gt=0)
    system_prompt_path: Path = RESOURCES_DIR / "system_prompt.txt"
    max_sentence_chars: int = Field(200, ge=40, le=600)


class RetrievalSettings(BaseModel):
    backend: Literal["chroma", "disabled"] = "chroma"
    faq_path: Path = Path("data/faqs.jsonl")
    persist_dir: Path = Path("data/chroma")
    embed_model: str = "intfloat/multilingual-e5-small"
    embed_device: str = "cpu"
    query_prefix: str = "query: "
    passage_prefix: str = "passage: "
    top_k: int = Field(3, ge=1, le=10)
    context_threshold: float = Field(0.55, ge=0.0, le=1.0)
    direct_threshold: float = Field(0.90, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def _thresholds_ordered(self) -> RetrievalSettings:
        if self.context_threshold > self.direct_threshold:
            raise ValueError("context_threshold must not exceed direct_threshold")
        return self


class STTSettings(BaseModel):
    backend: Literal["faster_whisper", "indic_conformer", "disabled"] = "faster_whisper"
    whisper_model: str = "small"
    device: str = "cpu"
    compute_type: str = "int8"


class TTSSettings(BaseModel):
    backend: Literal["mms", "indic_parler", "disabled"] = "mms"
    device: str = "cpu"
    voice_description: str = (
        "A female speaker delivers clear, warm and natural speech at a moderate pace, "
        "with very clear audio and no background noise."
    )


class SessionSettings(BaseModel):
    ttl_s: float = Field(1800.0, gt=0)
    max_sessions: int = Field(64, ge=1)
    max_history_turns: int = Field(6, ge=1, le=20)


class AudioSettings(BaseModel):
    input_sample_rate: int = 16_000
    max_utterance_s: float = Field(30.0, gt=0)
    min_utterance_ms: float = Field(200.0, ge=0)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SAHAYAK_",
        env_nested_delimiter="__",
        env_file=".env",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = 8000
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    # The UI is served from a different origin during development.
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    default_language: Language = Language.GUJARATI
    languages: list[Language] = [Language.GUJARATI, Language.HINDI, Language.ENGLISH]
    safety_rules_path: Path = RESOURCES_DIR / "safety_rules.yaml"

    llm: LLMSettings = LLMSettings()
    retrieval: RetrievalSettings = RetrievalSettings()
    stt: STTSettings = STTSettings()
    tts: TTSSettings = TTSSettings()
    sessions: SessionSettings = SessionSettings()
    audio: AudioSettings = AudioSettings()

    @model_validator(mode="after")
    def _default_language_is_supported(self) -> Settings:
        if self.default_language not in self.languages:
            raise ValueError("default_language must be one of languages")
        return self
