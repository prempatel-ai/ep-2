"""Prepare model text for speech synthesis."""

from __future__ import annotations

import re

_MARKDOWN_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_URL = re.compile(r"https?://\S+")
_HEADING = re.compile(r"^[ \t]*#{1,6}[ \t]*", re.MULTILINE)
_LIST_MARKER = re.compile(r"^[ \t]*(?:[-*•]|\d+[.)])[ \t]+", re.MULTILINE)
_EMPHASIS = re.compile(r"[*_`~]+")
# Pictographs and variation selectors. U+200D (ZWJ) is intentionally kept: Indic
# scripts use it to form conjuncts, and removing it would change pronunciation.
_PICTOGRAPHS = re.compile("[\U0001f300-\U0001faff\u2600-\u27bf\ufe0f]")
_WHITESPACE = re.compile(r"\s+")


def prepare_for_speech(text: str) -> str:
    """Strip markup and symbols that a speech model would read aloud or choke on."""
    text = _MARKDOWN_LINK.sub(r"\1", text)
    text = _URL.sub("", text)
    text = _HEADING.sub("", text)
    text = _LIST_MARKER.sub("", text)
    text = _EMPHASIS.sub("", text)
    text = _PICTOGRAPHS.sub("", text)
    return _WHITESPACE.sub(" ", text).strip()


def has_speakable_content(text: str) -> bool:
    """True if the text has at least one letter or digit worth synthesising."""
    return any(ch.isalnum() for ch in text)
