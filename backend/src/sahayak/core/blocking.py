"""Run blocking, non-thread-safe model code off the event loop."""

from __future__ import annotations

import asyncio
import functools
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any, TypeVar

T = TypeVar("T")


class BlockingRunner:
    """A single worker thread.

    Inference libraries are generally not safe to call concurrently on one model, so
    each adapter owns one runner. Calls are serialised per model while different
    models (speech-to-text, text-to-speech, embeddings) still run in parallel.
    """

    def __init__(self, name: str) -> None:
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix=name)

    async def run(self, func: Callable[..., T], /, *args: Any) -> T:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, functools.partial(func, *args))

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
