"""FAQ retrieval backed by a local ChromaDB collection."""

from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from pathlib import Path

from sahayak.core.blocking import BlockingRunner
from sahayak.domain.language import Language
from sahayak.domain.models import FAQEntry, FAQHit
from sahayak.domain.ports import Embedder

logger = logging.getLogger(__name__)

_COLLECTION = "faqs"


class ChromaFAQIndex:
    def __init__(self, *, persist_dir: Path, embedder: Embedder) -> None:
        self._persist_dir = persist_dir
        self._embedder = embedder
        self._runner = BlockingRunner("chroma")
        self._client = None

    async def load(self) -> None:
        await self._runner.run(self._open)

    def _open(self) -> None:
        import chromadb

        self._persist_dir.mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=str(self._persist_dir))

    def _collection(self):  # type: ignore[no-untyped-def]
        assert self._client is not None, "load() must be called first"
        return self._client.get_or_create_collection(_COLLECTION, metadata={"hnsw:space": "cosine"})

    async def size(self) -> int:
        return await self._runner.run(lambda: self._collection().count())

    async def search(self, query: str, limit: int) -> list[FAQHit]:
        vector = (await self._embedder.embed_queries([query]))[0]
        return await self._runner.run(self._query, vector, limit)

    def _query(self, vector: list[float], limit: int) -> list[FAQHit]:
        collection = self._collection()
        count = collection.count()
        if count == 0:
            return []
        result = collection.query(
            query_embeddings=[vector],
            n_results=min(limit, count),
            include=["metadatas", "distances"],
        )
        hits = []
        for meta, distance in zip(result["metadatas"][0], result["distances"][0], strict=True):
            score = min(1.0, max(0.0, 1.0 - float(distance)))
            hits.append(
                FAQHit(
                    question=meta["question"],
                    answer=meta["answer"],
                    score=score,
                    source=meta.get("source", ""),
                )
            )
        return hits

    async def rebuild(
        self,
        entries: Sequence[FAQEntry],
        batch_size: int = 256,
        on_progress: Callable[[int, int], None] | None = None,
    ) -> None:
        """Replace the whole index with ``entries``. Questions are embedded; answers are
        stored alongside and returned verbatim."""
        await self._runner.run(self._reset)
        for start in range(0, len(entries), batch_size):
            batch = entries[start : start + batch_size]
            vectors = await self._embedder.embed_passages([e.question for e in batch])
            await self._runner.run(self._add, batch, vectors)
            if on_progress:
                on_progress(min(start + batch_size, len(entries)), len(entries))
        logger.info("indexed %d FAQ entries", len(entries))

    def _reset(self) -> None:
        assert self._client is not None, "load() must be called first"
        try:
            self._client.delete_collection(_COLLECTION)
        except Exception:  # noqa: BLE001 - the collection may simply not exist yet
            logger.debug("no existing FAQ collection to delete")
        self._collection()

    def _add(self, batch: Sequence[FAQEntry], vectors: list[list[float]]) -> None:
        self._collection().add(
            ids=[e.id for e in batch],
            embeddings=vectors,
            metadatas=[
                {
                    "question": e.question,
                    "answer": e.answer,
                    "lang": e.language.value if isinstance(e.language, Language) else "",
                    "source": e.source,
                }
                for e in batch
            ],
        )
