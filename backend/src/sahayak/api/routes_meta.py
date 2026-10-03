"""Health, readiness and client-facing configuration."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response

from sahayak import __version__
from sahayak.api.deps import get_container
from sahayak.container import Container

router = APIRouter()
ContainerDep = Annotated[Container, Depends(get_container)]


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness: the process is up."""
    return {"status": "ok", "version": __version__}


@router.get("/ready")
async def ready(container: ContainerDep, response: Response) -> dict[str, object]:
    """Readiness: the model server and the FAQ index are usable."""
    status = await container.readiness()
    if not status["ready"]:
        response.status_code = 503
    return status


@router.get("/v1/config")
async def client_config(container: ContainerDep) -> dict[str, Any]:
    """What the UI needs to know to configure itself."""
    s = container.settings
    return {
        "languages": [
            {"code": lang.value, "name": lang.english_name, "native_name": lang.native_name}
            for lang in s.languages
        ],
        "default_language": s.default_language.value,
        "voice": container.turns.voice_available,
        "audio": {
            "input_sample_rate": s.audio.input_sample_rate,
            "input_format": "pcm_s16le_mono",
            "max_utterance_s": s.audio.max_utterance_s,
        },
    }
