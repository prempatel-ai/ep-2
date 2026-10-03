"""Text embeddings with sentence-transformers (multilingual E5 by default)."""

from __future__ import annotations

import logging
from collections.abc import Sequence

from sahayak.core.blocking import BlockingRunner

logger = logging.getLogger(__name__)


class SentenceTransformerEmbedder:
    """E5-family models expect ``query: `` / ``passage: `` prefixes; set both to an empty
    string for models that do not."""

    def __init__(
        self, *, model_name: str, device: str, query_prefix: str, passage_prefix: str
    ) -> None:
        self._model_name = model_name
        self._device = device
        self._query_prefix = query_prefix
        self._passage_prefix = passage_prefix
        self._runner = BlockingRunner("embedder")
        self._model = None

    async def load(self) -> None:
        await self._runner.run(self._load_model)

    def _load_model(self) -> None:
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(self._model_name, device=self._device)
        logger.info("loaded embedding model %s", self._model_name)

    async def embed_queries(self, texts: Sequence[str]) -> list[list[float]]:
        return await self._runner.run(self._embed, [self._query_prefix + t for t in texts])

    async def embed_passages(self, texts: Sequence[str]) -> list[list[float]]:
        return await self._runner.run(self._embed, [self._passage_prefix + t for t in texts])

    def _embed(self, texts: list[str]) -> list[list[float]]:
        assert self._model is not None, "load() must be called first"
        vectors = self._model.encode(
            texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False
        )
        return vectors.tolist()  # type: ignore[no-any-return]
