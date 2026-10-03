"""Logging configuration.

User questions and answers are medical conversations and are never logged. Logs carry
timings, counts and error details only.
"""

from __future__ import annotations

import logging


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        force=True,
    )
    # httpx logs every request URL at INFO, which is noise here.
    logging.getLogger("httpx").setLevel(logging.WARNING)
