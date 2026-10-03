"""Load and validate the verified FAQ file (JSON Lines)."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from sahayak.domain.language import Language
from sahayak.domain.models import FAQEntry
from sahayak.errors import ConfigurationError

_WHITESPACE = re.compile(r"\s+")


@dataclass(slots=True)
class LoadReport:
    lines_read: int = 0
    loaded: int = 0
    duplicates: int = 0
    # Same question, different answer: needs a human to decide which one is right.
    conflicts: list[int] = field(default_factory=list)
    invalid: list[tuple[int, str]] = field(default_factory=list)


def normalise_question(text: str) -> str:
    return _WHITESPACE.sub(" ", unicodedata.normalize("NFKC", text)).strip().casefold()


def load_faq_entries(path: Path) -> tuple[list[FAQEntry], LoadReport]:
    """Read ``{"question", "answer", "lang"?}`` records, one JSON object per line.

    Exact duplicates are dropped. Questions that repeat with a *different* answer keep
    the first occurrence and are reported as conflicts. Entries get stable ids derived
    from the normalised question, so rebuilding an index is idempotent.
    """
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ConfigurationError(f"Cannot read FAQ file {path}: {exc}") from exc

    report = LoadReport()
    entries: list[FAQEntry] = []
    seen: dict[str, str] = {}

    for line_no, line in enumerate(raw.splitlines(), start=1):
        if not line.strip():
            continue
        report.lines_read += 1
        record = _parse_record(line)
        if isinstance(record, str):
            report.invalid.append((line_no, record))
            continue

        question, answer, language = record
        key = normalise_question(question)
        if key in seen:
            if seen[key] == answer:
                report.duplicates += 1
            else:
                report.conflicts.append(line_no)
            continue
        seen[key] = answer
        entry_id = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
        entries.append(FAQEntry(entry_id, question, answer, language))
        report.loaded += 1

    if not entries:
        raise ConfigurationError(f"No valid FAQ entries found in {path}.")
    return entries, report


def _parse_record(line: str) -> tuple[str, str, Language | None] | str:
    """Return ``(question, answer, language)`` or a string describing why it is invalid."""
    try:
        data = json.loads(line)
    except json.JSONDecodeError as exc:
        return f"invalid JSON ({exc.msg})"
    if not isinstance(data, dict):
        return "expected a JSON object"

    question, answer = data.get("question"), data.get("answer")
    if not isinstance(question, str) or not question.strip():
        return "missing 'question'"
    if not isinstance(answer, str) or not answer.strip():
        return "missing 'answer'"

    language = None
    if (code := data.get("lang")) is not None:
        language = Language.parse(str(code))
        if language is None:
            return f"unsupported language {code!r}"
    return question.strip(), answer.strip(), language
