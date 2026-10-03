"""Request validation for the HTTP and WebSocket APIs."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator

from sahayak.domain.language import Language

SESSION_ID_PATTERN = r"^[A-Za-z0-9_-]{8,64}$"
MAX_TEXT_CHARS = 2000


def _strip(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("text must not be blank")
    return stripped


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    session_id: str | None = Field(default=None, pattern=SESSION_ID_PATTERN)
    language: Language | None = None

    _strip_text = field_validator("text")(_strip)


class StartMessage(BaseModel):
    """Optional first message: resume a session and/or fix the spoken language."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["start"]
    session_id: str | None = Field(default=None, pattern=SESSION_ID_PATTERN)
    language: Language | None = None  # null means: detect automatically


class TextMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["text"]
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    speak: bool = True

    _strip_text = field_validator("text")(_strip)


class InterruptMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["interrupt"]


ClientMessage = Annotated[
    StartMessage | TextMessage | InterruptMessage, Field(discriminator="type")
]
CLIENT_MESSAGE: TypeAdapter[ClientMessage] = TypeAdapter(ClientMessage)
