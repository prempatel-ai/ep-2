"""Parsing of OpenAI-style streaming (server-sent event) lines. Pure and dependency-free."""

from __future__ import annotations

import json

DONE = object()  # sentinel for the terminating ``data: [DONE]`` line


def parse_stream_line(line: str) -> str | object | None:
    """Return the text delta in one SSE line, ``DONE`` at end of stream, else ``None``.

    Lines that carry no text (comments, keep-alives, role-only or finish chunks) give
    ``None`` and are ignored by the caller.
    """
    line = line.strip()
    if not line.startswith("data:"):
        return None
    payload = line[len("data:") :].strip()
    if payload == "[DONE]":
        return DONE
    try:
        choices = json.loads(payload).get("choices") or []
    except (json.JSONDecodeError, AttributeError):
        return None
    if not choices:
        return None
    content = (choices[0].get("delta") or {}).get("content")
    return content or None
