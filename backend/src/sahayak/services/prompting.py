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
        system = f"{self._system_prompt}\n\nReply in {language.english_name}."
        if context:
            system += "\n\n" + self._format_context(context)
        return [
            ChatMessage("system", system),
            *history,
            ChatMessage("user", user_text),
        ]

    @staticmethod
    def _format_context(context: Sequence[FAQHit]) -> str:
        lines = ["Verified reference information. Base factual statements only on this:"]
        for number, hit in enumerate(context, start=1):
            lines.append(f"[{number}] Q: {hit.question}")
            lines.append(f"    A: {hit.answer}")
        return "\n".join(lines)
