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
    PROPOSED_FINDING_CATEGORIES,
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
                "enum": sorted(PROPOSED_FINDING_CATEGORIES),
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
                    "role": "system",
                    "content": prompt,
                },
                {
                    "role": "user",
                    "content": "Please observe and describe the visual features in this photograph.",
                    "images": [b64],
                },
            ],
            "stream": False,
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
            return ImageAnalysisResult(status=ImageCheckStatus.ERROR, findings=[], observation_text="")

        # Check if the output is JSON
        try:
            parsed = json.loads(content_raw)
            if isinstance(parsed, dict) and "status" in parsed:
                raw_status = parsed.get("status")
                try:
                    status = ImageCheckStatus(raw_status)
                except (ValueError, TypeError):
                    status = ImageCheckStatus.OK
                findings_raw = parsed.get("findings", [])
                validated_findings = [
                    f for f in findings_raw if isinstance(f, str) and f in ALL_ALLOWED_CATEGORIES
                ]
                obs_text = parsed.get("observation", parsed.get("observation_notes", content_raw))
                return ImageAnalysisResult(
                    status=status,
                    findings=validated_findings,
                    observation_text=str(obs_text),
                )
        except json.JSONDecodeError:
            pass

        # Free-form natural clinical text response
        lower = content_raw.lower()
        findings: list[str] = []
        if any(k in lower for k in ["redness", "erythema", "inflammation"]) or (" red " in lower):
            findings.append("finding_redness")
        if any(k in lower for k in ["thick", "edema", "swollen", "swelling"]):
            findings.append("finding_skin_thickening")
        if any(k in lower for k in ["dimpling", "peau d orange", "peau d'orange", "pitting", "dimple"]):
            findings.append("finding_dimpling")
        if any(k in lower for k in ["scaling", "scaly", "flaking", "crust"]):
            findings.append("finding_scaling")
        if any(k in lower for k in ["nipple", "areola"]):
            findings.append("finding_nipple_change")
        if any(k in lower for k in ["lump", "asymmetry", "bulge", "contour distortion"]):
            findings.append("finding_visible_lump_or_shape_difference")
        if any(k in lower for k in ["sore", "ulcer", "breakdown"]):
            findings.append("finding_open_sore")

        if any(k in lower for k in ["not a clinical", "not a breast", "not human skin", "does not depict human", "solid color"]):
            status = ImageCheckStatus.NOT_A_BREAST_PHOTO
        elif any(k in lower for k in ["too blurry", "too dark", "unclear for visual"]):
            status = ImageCheckStatus.UNCLEAR_IMAGE
        else:
            status = ImageCheckStatus.OK

        return ImageAnalysisResult(
            status=status,
            findings=findings,
            observation_text=content_raw,
        )

    async def analyze(self, image_bytes: bytes, prompt: str) -> ImageAnalysisResult:
        """Run image analysis through single-worker thread runner."""
        return await self._runner.run(self._sync_analyze, image_bytes, prompt)

    async def aclose(self) -> None:
        self._runner.close()
