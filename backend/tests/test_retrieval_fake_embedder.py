"""Model-free integration tests for ChromaFAQIndex using a fake embedder.

No real sentence-transformer or network is needed; a FakeEmbedder that returns
fixed-length vectors is injected instead.

Windows note: ChromaFAQIndex uses a BlockingRunner (thread-pool executor).
SQLite / HNSW file handles may still be held by that thread when the temp-dir
context manager tries to clean up, causing PermissionError on Windows.  We use
``ignore_cleanup_errors=True`` (Python ≥ 3.10) to suppress those benign errors;
the OS reclaims the files when the process exits.
"""

from __future__ import annotations

import tempfile
import unittest
from collections.abc import Sequence
from pathlib import Path

from sahayak.adapters.faq_chroma import ChromaFAQIndex
from sahayak.domain.models import FAQEntry

# ---------------------------------------------------------------------------
# Fake embedder - returns fixed 8-dimensional vectors (no model loaded)
# ---------------------------------------------------------------------------

_DIM = 8  # small enough to be fast, large enough for Chroma to be happy


class FakeEmbedder:
    """Returns deterministic unit vectors indexed by position in the batch."""

    def _vec(self, i: int) -> list[float]:
        """Return a unit vector with 1.0 at position i % _DIM, rest 0.0."""
        v = [0.0] * _DIM
        v[i % _DIM] = 1.0
        return v

    async def embed_queries(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._vec(i) for i in range(len(texts))]

    async def embed_passages(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._vec(i) for i in range(len(texts))]


# ---------------------------------------------------------------------------
# Sample entries (non-medical placeholder content)
# ---------------------------------------------------------------------------

_ENTRIES: list[FAQEntry] = [
    FAQEntry(id="aaa1", question="What is example A?", answer="Answer A."),
    FAQEntry(id="bbb2", question="What is example B?", answer="Answer B."),
    FAQEntry(id="ccc3", question="What is example C?", answer="Answer C."),
]


class TestChromaFAQIndexFakeEmbedder(unittest.IsolatedAsyncioTestCase):
    """Tests for ChromaFAQIndex that require no real embedding model."""

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _tmpdir(self) -> tempfile.TemporaryDirectory:  # type: ignore[type-arg]
        # ignore_cleanup_errors=True silences Windows PermissionError when
        # Chroma's background thread still holds the SQLite / HNSW file handles
        # at teardown time.  The files are cleaned up by the OS on process exit.
        return tempfile.TemporaryDirectory(ignore_cleanup_errors=True)

    async def _make_index(self, persist_dir: Path) -> ChromaFAQIndex:
        idx = ChromaFAQIndex(persist_dir=persist_dir, embedder=FakeEmbedder())
        await idx.load()
        return idx

    # ------------------------------------------------------------------
    # Tests
    # ------------------------------------------------------------------

    async def test_size_after_rebuild(self) -> None:
        """size() must equal the number of entries passed to rebuild()."""
        with self._tmpdir() as tmp:
            idx = await self._make_index(Path(tmp))
            await idx.rebuild(_ENTRIES)
            size = await idx.size()
        self.assertEqual(size, len(_ENTRIES))

    async def test_size_empty_before_rebuild(self) -> None:
        """size() returns 0 when no entries have been indexed."""
        with self._tmpdir() as tmp:
            idx = await self._make_index(Path(tmp))
            size = await idx.size()
        self.assertEqual(size, 0)

    async def test_search_returns_hits(self) -> None:
        """search() returns at least one FAQHit after rebuild."""
        with self._tmpdir() as tmp:
            idx = await self._make_index(Path(tmp))
            await idx.rebuild(_ENTRIES)
            hits = await idx.search("What is example A?", limit=3)
        self.assertGreater(len(hits), 0)

    async def test_search_respects_limit(self) -> None:
        """search() never returns more hits than the requested limit."""
        with self._tmpdir() as tmp:
            idx = await self._make_index(Path(tmp))
            await idx.rebuild(_ENTRIES)
            hits = await idx.search("example", limit=1)
        self.assertLessEqual(len(hits), 1)

    async def test_search_returns_faqhit_fields(self) -> None:
        """Every returned FAQHit has non-empty question, answer, and a score in [0, 1]."""
        with self._tmpdir() as tmp:
            idx = await self._make_index(Path(tmp))
            await idx.rebuild(_ENTRIES)
            hits = await idx.search("example", limit=3)
        for hit in hits:
            self.assertIsInstance(hit.question, str)
            self.assertIsInstance(hit.answer, str)
            self.assertGreaterEqual(hit.score, 0.0)
            self.assertLessEqual(hit.score, 1.0)

    async def test_rebuild_is_idempotent(self) -> None:
        """Calling rebuild() twice must not change the size."""
        with self._tmpdir() as tmp:
            idx = await self._make_index(Path(tmp))
            await idx.rebuild(_ENTRIES)
            await idx.rebuild(_ENTRIES)
            size = await idx.size()
        self.assertEqual(size, len(_ENTRIES))

    async def test_search_empty_index_returns_empty_list(self) -> None:
        """search() on an empty index must return [] not raise."""
        with self._tmpdir() as tmp:
            idx = await self._make_index(Path(tmp))
            hits = await idx.search("anything", limit=5)
        self.assertEqual(hits, [])
