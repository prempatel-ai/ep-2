"""Languages the assistant supports."""

from __future__ import annotations

from enum import StrEnum


class Language(StrEnum):
    GUJARATI = "gu"
    HINDI = "hi"
    ENGLISH = "en"

    @property
    def english_name(self) -> str:
        return _NAMES[self][0]

    @property
    def native_name(self) -> str:
        return _NAMES[self][1]

    @classmethod
    def parse(cls, code: str | None) -> Language | None:
        """Map a code such as ``"gu"`` or ``"gu-IN"`` to a supported language, else ``None``."""
        if not code:
            return None
        primary = code.strip().lower().replace("_", "-").split("-")[0]
        try:
            return cls(primary)
        except ValueError:
            return None


_NAMES: dict[Language, tuple[str, str]] = {
    Language.GUJARATI: ("Gujarati", "ગુજરાતી"),
    Language.HINDI: ("Hindi", "हिन्दी"),
    Language.ENGLISH: ("English", "English"),
}
