"""Image Check endpoint."""

from __future__ import annotations

import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from sahayak.api.deps import get_container
from sahayak.container import Container
from sahayak.errors import (
    ImageAnalysisUnavailableError,
    ImageCheckDisabledError,
    ImagePayloadTooLargeError,
    InvalidImageError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["image-check"])
ContainerDep = Annotated[Container, Depends(get_container)]


class ImageCheckMessagesOut(BaseModel):
    findings_summary: str
    referral_guidance: str
    educational_disclaimer: str
    observation_notes: str = ""


class ImageCheckResponseOut(BaseModel):
    status: str
    findings: list[str]
    referral_required: bool
    messages: ImageCheckMessagesOut


@router.post(
    "/image-check",
    response_model=ImageCheckResponseOut,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "Invalid image payload or unsupported format."},
        413: {"description": "Image payload exceeds maximum file size limit."},
        503: {"description": "Image check feature is disabled or model server unavailable."},
    },
)
async def analyze_image(
    container: ContainerDep,
    image: UploadFile,
    language: Annotated[str, Form()] = "en",
) -> ImageCheckResponseOut:
    """Analyze an uploaded image for visible surface skin features using a local model."""
    start_time = time.perf_counter()

    if not container.settings.image_check.enabled or container.image_check is None:
        logger.info("Image check request rejected: feature is disabled in settings.")
        raise ImageCheckDisabledError("Image check is currently disabled.")

    if not image or not image.filename:
        raise InvalidImageError("No image file provided in upload.")

    content_type = image.content_type or ""
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if content_type.lower() not in allowed_types:
        raise InvalidImageError(
            f"Unsupported content type: {content_type}. Allowed: image/jpeg, image/png, image/webp"
        )

    try:
        raw_bytes = await image.read()
    except Exception as exc:
        logger.warning("Failed to read uploaded image bytes: %s", exc)
        raise InvalidImageError("Could not read uploaded image bytes.") from exc

    size_bytes = len(raw_bytes)

    try:
        result = await container.image_check.check(raw_bytes, language=language)
    except (
        ImagePayloadTooLargeError,
        InvalidImageError,
        ImageAnalysisUnavailableError,
        ImageCheckDisabledError,
    ):
        # Propagate known domain errors to exception handler
        raise
    except Exception as exc:
        elapsed = time.perf_counter() - start_time
        logger.error(
            "Unexpected error during image check: error_class=%s, size_bytes=%d, elapsed=%.3fs",
            exc.__class__.__name__,
            size_bytes,
            elapsed,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the image check.",
        ) from exc
    finally:
        del raw_bytes

    elapsed = time.perf_counter() - start_time
    # Logging: record timing, size, status, and error class only.
    # Never log image bytes or findings text.
    logger.info(
        "Image check completed: status=%s, size_bytes=%d, elapsed=%.3fs",
        result.status.value,
        size_bytes,
        elapsed,
    )

    return ImageCheckResponseOut(
        status=result.status.value,
        findings=result.findings,
        referral_required=result.referral_required,
        messages=ImageCheckMessagesOut(
            findings_summary=result.summary_message,
            referral_guidance=result.referral_message,
            educational_disclaimer=result.educational_disclaimer,
            observation_notes=result.observation_notes,
        ),
    )
