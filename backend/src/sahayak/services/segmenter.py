"""Incremental sentence segmentation for streamed model output.

Text arrives from the language model in arbitrary fragments. The speech pipeline
needs whole sentences as early as possible, so the first sentence can be spoken
while the rest is still being generated.
"""

from __future__ import annotations

import re

_TERMINATORS = frozenset(".!?।॥…")
_TRAILING_CLOSERS = frozenset("\"'”’)]»")
_CLAUSE_BREAKS = ",;:،"
_ABBREVIATIONS = frozenset({"dr", "mr", "mrs", "ms", "prof", "vs"})
_LAST_WORD = re.compile(r"([A-Za-z]+)$")


class SentenceSegmenter:
    """Feed text fragments, receive complete sentences.

    A terminator ends a sentence only when followed by whitespace, so decimals such
    as ``3.5`` and abbreviations such as ``Dr.`` do not split. A sentence longer than
    ``max_chars`` is broken at a clause boundary (or a space) so speech never stalls
    waiting for a terminator that may not come.
    """

    def __init__(self, max_chars: int = 200, first_chunk_early: bool = False) -> None:
        if max_chars < 20:
            raise ValueError("max_chars must be at least 20")
        self._max_chars = max_chars
        self._first_chunk_early = first_chunk_early
        self._emitted_first = False
        self._buffer = ""

    def feed(self, chunk: str) -> list[str]:
        self._buffer += chunk
        sentences = self._extract_complete()
        while len(self._buffer) > self._max_chars:
            cut = self._find_cut(self._buffer)
            piece = self._buffer[:cut].strip()
            self._buffer = self._buffer[cut:]
            if piece:
                sentences.append(piece)
        if sentences:
            self._emitted_first = True
        return sentences

    def flush(self) -> list[str]:
        """Return whatever remains, ending the stream."""
        rest = self._buffer.strip()
        self._buffer = ""
        return self._wrap(rest) if rest else []

    def _extract_complete(self) -> list[str]:
        buf = self._buffer
        n = len(buf)
        sentences: list[str] = []
        start = 0
        i = 0
        while i < n:
            char = buf[i]
            if char == "\n":
                sentences.extend(self._wrap(buf[start:i].strip()))
                start = i = i + 1
                continue
            if self._first_chunk_early and not self._emitted_first and char in _CLAUSE_BREAKS:
                end = i + 1
                if end < n and buf[end].isspace():
                    candidate = buf[start:i].strip()
                    if len(candidate) >= 20:
                        sentences.append(candidate + char)
                        self._emitted_first = True
                        start = i = end
                        continue
            if char in _TERMINATORS:
                end = i + 1
                while end < n and (buf[end] in _TERMINATORS or buf[end] in _TRAILING_CLOSERS):
                    end += 1
                if end == n:
                    break  # the next character decides whether the sentence ends here
                if buf[end].isspace() and not self._is_abbreviation(buf[start:i], char):
                    sentences.extend(self._wrap(buf[start:end].strip()))
                    start = i = end
                    continue
                i = end
                continue
            i += 1
        self._buffer = buf[start:]
        return sentences

    @staticmethod
    def _is_abbreviation(before: str, terminator: str) -> bool:
        if terminator != ".":
            return False
        match = _LAST_WORD.search(before)
        return bool(match) and match.group(1).lower() in _ABBREVIATIONS

    def _wrap(self, text: str) -> list[str]:
        pieces: list[str] = []
        while len(text) > self._max_chars:
            cut = self._find_cut(text)
            piece = text[:cut].strip()
            if piece:
                pieces.append(piece)
            text = text[cut:].strip()
        if text:
            pieces.append(text)
        return pieces

    def _find_cut(self, text: str) -> int:
        window = text[: self._max_chars]
        floor = self._max_chars // 3
        clause = max(window.rfind(c) for c in _CLAUSE_BREAKS)
        if clause >= floor:
            return clause + 1
        space = window.rfind(" ")
        if space >= floor:
            return space + 1
        return self._max_chars
