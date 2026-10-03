"""Rule-based safety guard.

Runs before retrieval and before the model. Questions that describe an emergency,
express self-harm, or ask for a personal diagnosis or dose get a fixed, reviewed
reply instead of generated text. Rules live in YAML so a clinician can review them
without reading code.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Any

import yaml

from sahayak.domain.language import Language
from sahayak.errors import ConfigurationError


class SafetyCategory(StrEnum):
    EMERGENCY = "emergency"
    SELF_HARM = "self_harm"
    PERSONAL_MEDICAL = "personal_medical"


@dataclass(frozen=True, slots=True)
class SafetyVerdict:
    category: SafetyCategory
    reply: str


@dataclass(frozen=True, slots=True)
class _Rule:
    category: SafetyCategory
    patterns: tuple[re.Pattern[str], ...]
    replies: Mapping[Language, str]

    def reply_for(self, language: Language) -> str:
        return self.replies.get(language) or self.replies[Language.ENGLISH]


def _normalise(text: str) -> str:
    return unicodedata.normalize("NFKC", text).casefold()


class SafetyGuard:
    def __init__(self, rules: Sequence[_Rule]) -> None:
        self._rules = tuple(rules)

    def check(self, text: str, language: Language) -> SafetyVerdict | None:
        """Return a verdict for the first matching category, in file order."""
        normalised = _normalise(text)
        for rule in self._rules:
            if any(pattern.search(normalised) for pattern in rule.patterns):
                return SafetyVerdict(rule.category, rule.reply_for(language))
        return None

    @classmethod
    def from_yaml(cls, path: Path) -> SafetyGuard:
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError) as exc:
            raise ConfigurationError(f"Cannot read safety rules at {path}: {exc}") from exc
        return cls.from_mapping(data)

    @classmethod
    def from_mapping(cls, data: Any) -> SafetyGuard:
        if not isinstance(data, Mapping) or not isinstance(data.get("categories"), Mapping):
            raise ConfigurationError("Safety rules need a top-level 'categories' mapping.")
        rules = [cls._parse_category(name, body) for name, body in data["categories"].items()]
        if not rules:
            raise ConfigurationError("Safety rules define no categories.")
        return cls(rules)

    @staticmethod
    def _parse_category(name: str, body: Any) -> _Rule:
        try:
            category = SafetyCategory(name)
        except ValueError as exc:
            raise ConfigurationError(f"Unknown safety category '{name}'.") from exc
        if not isinstance(body, Mapping):
            raise ConfigurationError(f"Safety category '{name}' must be a mapping.")

        patterns: list[re.Pattern[str]] = []
        for lang_code, items in (body.get("patterns") or {}).items():
            for item in items or []:
                try:
                    patterns.append(re.compile(unicodedata.normalize("NFKC", item), re.IGNORECASE))
                except re.error as exc:
                    raise ConfigurationError(
                        f"Invalid pattern {item!r} in '{name}' ({lang_code}): {exc}"
                    ) from exc
        if not patterns:
            raise ConfigurationError(f"Safety category '{name}' has no patterns.")

        replies: dict[Language, str] = {}
        for lang_code, reply in (body.get("replies") or {}).items():
            language = Language.parse(lang_code)
            if language is None:
                raise ConfigurationError(f"Unknown language '{lang_code}' in '{name}' replies.")
            replies[language] = str(reply).strip()
        if Language.ENGLISH not in replies:
            raise ConfigurationError(f"Safety category '{name}' needs an English reply.")

        return _Rule(category, tuple(patterns), replies)
