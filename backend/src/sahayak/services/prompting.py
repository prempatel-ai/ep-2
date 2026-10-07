"""Build the message list sent to the language model.

The layout here must mirror the format used when the model was fine-tuned. If you
change how the system prompt, language instruction or context block is written,
change the training data to match (or retrain), or answer quality will drop.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

from sahayak.domain.language import Language
from sahayak.domain.models import ChatMessage, FAQHit
from sahayak.errors import ConfigurationError


class PromptBuilder:
    def __init__(self, system_prompt: str) -> None:
        self._system_prompt = system_prompt.strip()
        if not self._system_prompt:
            raise ConfigurationError("The system prompt is empty.")

    @classmethod
    def from_file(cls, path: Path) -> PromptBuilder:
        try:
            return cls(path.read_text(encoding="utf-8"))
        except OSError as exc:
            raise ConfigurationError(f"Cannot read system prompt at {path}: {exc}") from exc

    def build(
        self,
        *,
        user_text: str,
        language: Language,
        history: Sequence[ChatMessage] = (),
        context: Sequence[FAQHit] = (),
    ) -> list[ChatMessage]:
        system = (
            f"{self._system_prompt}\n\n"
            f"Reply in {language.english_name}.\n"
            f"Important: You must compose and write your entire response strictly in {language.english_name} "
            f"({language.native_name}) script only. Do not respond in English unless the requested language is English."
        )
        if context:
            system += "\n\n" + self._format_context(context, language)

        return [
            ChatMessage("system", system),
            *history,
            ChatMessage("user", user_text),
        ]

    @staticmethod
    def _format_context(context: Sequence[FAQHit], language: Language | None = None) -> str:
        lang_note = ""
        if language and language != Language.ENGLISH:
            lang_note = f" Translate and explain all facts from the reference strictly in {language.english_name} ({language.native_name})."
        lines = [
            f"Verified clinical reference information. Base factual statements only on this.{lang_note}",
            "Do not write a manual Sources line; citations will be appended automatically.",
        ]
        for number, hit in enumerate(context, start=1):
            src = f" (Source: {hit.source})" if hit.source else ""
            lines.append(f"[{number}] Q: {hit.question}{src}")
            lines.append(f"    A: {hit.answer}")
        return "\n".join(lines)
