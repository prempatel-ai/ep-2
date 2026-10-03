"""Decide how retrieved FAQ entries are used for a question."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import StrEnum

from sahayak.domain.models import FAQHit
from sahayak.domain.ports import FAQRetriever

logger = logging.getLogger(__name__)


class RetrievalMode(StrEnum):
    DIRECT = "direct"  # near-exact match: answer verbatim from the verified FAQ
    CONTEXT = "context"  # related entries: give them to the model as reference
    NONE = "none"  # nothing relevant


@dataclass(frozen=True, slots=True)
class RetrievalPolicy:
    top_k: int = 3
    context_threshold: float = 0.55
    direct_threshold: float = 0.90

    def __post_init__(self) -> None:
        if self.top_k < 1:
            raise ValueError("top_k must be at least 1")
        if not 0.0 <= self.context_threshold <= self.direct_threshold <= 1.0:
            raise ValueError("thresholds must satisfy 0 <= context <= direct <= 1")


@dataclass(frozen=True, slots=True)
class RetrievalResult:
    mode: RetrievalMode
    hits: tuple[FAQHit, ...] = ()


class NullRetriever:
    """Retriever for deployments that run without a FAQ index."""

    async def search(self, query: str, limit: int) -> list[FAQHit]:
        return []

    async def size(self) -> int:
        return 0


class RetrievalService:
    def __init__(self, retriever: FAQRetriever, policy: RetrievalPolicy) -> None:
        self._retriever = retriever
        self._policy = policy

    async def lookup(self, query: str) -> RetrievalResult:
        """Find FAQ entries for ``query``. Retrieval failures degrade to ``NONE``."""
        try:
            hits = await self._retriever.search(query, self._policy.top_k)
        except Exception:
            logger.exception("FAQ retrieval failed; continuing without it")
            return RetrievalResult(RetrievalMode.NONE)

        ranked = sorted(hits, key=lambda h: h.score, reverse=True)
        if not ranked:
            return RetrievalResult(RetrievalMode.NONE)
        if ranked[0].score >= self._policy.direct_threshold:
            return RetrievalResult(RetrievalMode.DIRECT, (ranked[0],))
        relevant = tuple(h for h in ranked if h.score >= self._policy.context_threshold)
        if relevant:
            return RetrievalResult(RetrievalMode.CONTEXT, relevant)
        return RetrievalResult(RetrievalMode.NONE)
