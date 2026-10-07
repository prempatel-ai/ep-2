"""Text chat over server-sent events, plus session deletion."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import aclosing
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import StreamingResponse

from sahayak.api.deps import get_container
from sahayak.api.schemas import SESSION_ID_PATTERN, ChatRequest
from sahayak.api.serialization import error_payload, serialize_event, sse_frame
from sahayak.container import Container
from sahayak.domain.events import AudioReady
from sahayak.errors import SahayakError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1")
ContainerDep = Annotated[Container, Depends(get_container)]


@router.post("/chat")
async def chat(request: ChatRequest, container: ContainerDep) -> StreamingResponse:
    """Stream the answer to a typed question as server-sent events.

    Events: ``session`` once, then ``sentence`` per sentence, then ``done``.
    Failures after the stream has started arrive as an ``error`` event.
    """
    session = container.sessions.get_or_create(request.session_id)

    async def events() -> AsyncIterator[str]:
        yield sse_frame({"type": "session", "session_id": session.id})
        try:
            turn = container.turns.run_text_turn(session, request.text, request.language)
            async with aclosing(turn) as stream:
                async for event in stream:
                    if not isinstance(event, AudioReady):
                        yield sse_frame(serialize_event(event))
        except SahayakError as exc:
            yield sse_frame(error_payload(exc))
        except Exception:
            logger.exception("chat turn failed")
            yield sse_frame(error_payload(SahayakError("Something went wrong.")))

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/sessions/{session_id}", status_code=204, response_model=None)
async def delete_session(
    container: ContainerDep,
    session_id: Annotated[str, Path(pattern=SESSION_ID_PATTERN)],
) -> None:
    """Forget a conversation immediately."""
    if not container.sessions.drop(session_id):
        raise HTTPException(status_code=404, detail="Session not found.")
