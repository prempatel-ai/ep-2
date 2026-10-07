"""Image decoding, sanitization, and in-memory preparation."""

from __future__ import annotations

import io
import logging
from typing import BinaryIO

from PIL import Image, UnidentifiedImageError

from sahayak.errors import ImagePayloadTooLargeError, InvalidImageError

logger = logging.getLogger(__name__)

DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit
DEFAULT_MAX_DIMENSION = 1024
ALLOWED_IMAGE_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})


def sanitize_and_prepare_image(
    raw_data: bytes | BinaryIO,
    *,
    max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES,
    max_dimension: int = DEFAULT_MAX_DIMENSION,
) -> tuple[bytes, str]:
    """Validate, sanitize, strip metadata, and resize an image entirely in memory.

    Returns:
        tuple of (sanitized_png_bytes, mime_type)
    Raises:
        ImagePayloadTooLargeError: if payload exceeds max_file_size_bytes.
        InvalidImageError: if image is invalid, corrupted, or unsupported.
    """
    data_bytes = (
        bytes(raw_data) if isinstance(raw_data, (bytes, bytearray)) else raw_data.read()
    )

    if len(data_bytes) > max_file_size_bytes:
        raise ImagePayloadTooLargeError(
            f"Image payload size ({len(data_bytes)} bytes) exceeds limit of"
            f" {max_file_size_bytes} bytes."
        )

    if not data_bytes:
        raise InvalidImageError("Image payload is empty.")

    try:
        buffer = io.BytesIO(data_bytes)
        with Image.open(buffer) as img:
            img_format = (img.format or "").upper()
            if img_format not in ALLOWED_IMAGE_FORMATS:
                raise InvalidImageError(
                    f"Unsupported image format: {img_format or 'unknown'}."
                    " Allowed: JPEG, PNG, WEBP."
                )

            # Strip all metadata (EXIF, ICC, GPS) by constructing a clean RGB image
            rgb_img = img.convert("RGB")

            # Constrain dimensions if larger than working resolution
            width, height = rgb_img.size
            if max(width, height) > max_dimension:
                scale = max_dimension / max(width, height)
                new_size = (int(width * scale), int(height * scale))
                resized_img = rgb_img.resize(new_size, resample=Image.Resampling.LANCZOS)
                rgb_img.close()
                rgb_img = resized_img

            # Re-encode clean bytes to in-memory PNG without metadata
            out_buf = io.BytesIO()
            rgb_img.save(out_buf, format="PNG", optimize=True)
            clean_bytes = out_buf.getvalue()

            rgb_img.close()
            out_buf.close()

            return clean_bytes, "image/png"

    except UnidentifiedImageError as exc:
        raise InvalidImageError("Could not identify or decode image payload.") from exc
    except InvalidImageError:
        raise
    except Exception as exc:
        logger.warning("Failed to process image payload: %s", exc)
        raise InvalidImageError(f"Failed to process image: {exc}") from exc
    finally:
        del data_bytes
