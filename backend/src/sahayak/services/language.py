"""Script-based language detection for text.

This is deliberately simple. It tells Gujarati, Devanagari (treated as Hindi) and
Latin script apart, which is all the assistant needs when the client has not stated
a language. Limitations: Marathi and other Devanagari languages are reported as
Hindi, and romanised Hindi/Gujarati ("Hinglish") is reported as English.
"""

from __future__ import annotations

from collections import Counter

from sahayak.domain.language import Language

_GUJARATI_BLOCK = range(0x0A80, 0x0B00)
_DEVANAGARI_BLOCK = range(0x0900, 0x0980)


def _language_of(char: str) -> Language | None:
    code_point = ord(char)
    if code_point in _GUJARATI_BLOCK:
        return Language.GUJARATI
    if code_point in _DEVANAGARI_BLOCK:
        return Language.HINDI
    if char.isascii() and char.isalpha():
        return Language.ENGLISH
    return None


def detect_language(text: str, default: Language) -> Language:
    """Return the dominant script's language, or ``default`` if there is no letter."""
    counts = Counter(lang for ch in text if (lang := _language_of(ch)) is not None)
    if not counts:
        return default
    return counts.most_common(1)[0][0]
