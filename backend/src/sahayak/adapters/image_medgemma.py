"""MedGemma 4B image analyzer adapter using local Ollama service."""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

import httpx

from sahayak.core.blocking import BlockingRunner
from sahayak.domain.image import (
    ALL_ALLOWED_CATEGORIES,
    ImageAnalysisResult,
    ImageCheckStatus,
)
from sahayak.errors import ImageAnalysisUnavailableError

logger = logging.getLogger(__name__)

IMAGE_CHECK_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "status": {
            "type": "string",
            "enum": ["ok", "unclear_image", "not_a_breast_photo"],
        },
        "findings": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": sorted(ALL_ALLOWED_CATEGORIES),
            },
        },
    },
    "required": ["status", "findings"],
}


class OllamaMedGemmaAnalyzer:
    """Multimodal image observation adapter connecting to local Ollama service."""

    def __init__(
        self,
        *,
        base_url: str = "http://127.0.0.1:11434",
        model: str = "medgemma:4b",
        timeout_s: float = 120.0,
        keep_alive: str = "5m",
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout_s = timeout_s
        self._keep_alive = keep_alive
        self._runner = BlockingRunner("image-medgemma")

    def _sync_is_ready(self) -> bool:
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(f"{self._base_url}/api/tags")
                if resp.status_code != 200:
                    return False
                models = [m.get("name", "") for m in resp.json().get("models", [])]
                return any(self._model in m for m in models)
        except Exception:
            return False

    async def is_ready(self) -> bool:
        """Check if local Ollama service is up and MedGemma model is available."""
        return await self._runner.run(self._sync_is_ready)

    def _sync_analyze(self, image_bytes: bytes, prompt: str) -> ImageAnalysisResult:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [b64],
                }
            ],
            "stream": False,
            "format": IMAGE_CHECK_SCHEMA,
            "keep_alive": self._keep_alive,
        }

        try:
            with httpx.Client(timeout=self._timeout_s) as client:
                resp = client.post(f"{self._base_url}/api/chat", json=payload)
                if resp.status_code != 200:
                    body_sample = resp.text[:200]
                    logger.error("Ollama returned HTTP %d: %s", resp.status_code, body_sample)
                    raise ImageAnalysisUnavailableError(
                        f"Local model server returned HTTP {resp.status_code}: {body_sample}"
                    )
                data = resp.json()
        except httpx.HTTPError as exc:
            logger.error("Failed to connect to local image model server: %s", exc)
            raise ImageAnalysisUnavailableError(
                f"Cannot reach local image model server: {exc}"
            ) from exc
        finally:
            del b64
            del payload

        content_raw = data.get("message", {}).get("content", "").strip()
        if not content_raw:
            logger.warning("Local model server returned empty response content.")
            return ImageAnalysisResult(status=ImageCheckStatus.ERROR, findings=[])

        try:
            parsed = json.loads(content_raw)
        except json.JSONDecodeError as exc:
            logger.warning("Model output was not valid JSON: %s (%s)", content_raw, exc)
            return ImageAnalysisResult(status=ImageCheckStatus.ERROR, findings=[])

        raw_status = parsed.get("status")
        try:
            status = ImageCheckStatus(raw_status)
        except (ValueError, TypeError):
            logger.warning("Model returned unknown status: %s", raw_status)
            return ImageAnalysisResult(status=ImageCheckStatus.ERROR, findings=[])

        findings_raw = parsed.get("findings", [])
        if not isinstance(findings_raw, list):
            logger.warning("Model findings was not a list: %r", findings_raw)
            return ImageAnalysisResult(status=ImageCheckStatus.ERROR, findings=[])

        # Filter strictly by known allowed categories
        validated_findings = [
            f for f in findings_raw if isinstance(f, str) and f in ALL_ALLOWED_CATEGORIES
        ]
        return ImageAnalysisResult(status=status, findings=validated_findings)

    async def analyze(self, image_bytes: bytes, prompt: str) -> ImageAnalysisResult:
        """Run image analysis through single-worker thread runner."""
        return await self._runner.run(self._sync_analyze, image_bytes, prompt)

    async def aclose(self) -> None:
        self._runner.close()
