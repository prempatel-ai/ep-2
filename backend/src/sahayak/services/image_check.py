"""Image Check service orchestrating image sanitization, analysis, validation, and guard."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

from sahayak.domain.image import (
    ALL_ALLOWED_CATEGORIES,
    ImageAnalysisResult,
    ImageCheckResponse,
    ImageCheckStatus,
)
from sahayak.domain.ports import ImageAnalyzer
from sahayak.errors import ImageCheckDisabledError
from sahayak.services.image_prep import (
    DEFAULT_MAX_DIMENSION,
    DEFAULT_MAX_FILE_SIZE_BYTES,
    sanitize_and_prepare_image,
)

logger = logging.getLogger(__name__)


class ImageCheckService:
    """Service coordinating safe image intake, local observation, and guarded delivery."""

    def __init__(
        self,
        *,
        analyzer: ImageAnalyzer,
        prompt_path: Path,
        messages_path: Path,
        enabled: bool = False,
        max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES,
        max_dimension: int = DEFAULT_MAX_DIMENSION,
    ) -> None:
        self._analyzer = analyzer
        self._prompt_path = prompt_path
        self._messages_path = messages_path
        self._enabled = enabled
        self._max_file_size_bytes = max_file_size_bytes
        self._max_dimension = max_dimension
        self._messages = self._load_messages(messages_path)

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    @staticmethod
    def _load_messages(path: Path) -> dict[str, Any]:
        if not path.is_file():
            logger.warning(
                "Messages file not found at %s; using minimal fallback dictionary.", path
            )
            return {}
        try:
            with open(path, encoding="utf-8") as fp:
                data = yaml.safe_load(fp)
                return data if isinstance(data, dict) else {}
        except Exception as exc:
            logger.error("Failed to parse image check messages YAML: %s", exc)
            return {}

    def _load_prompt(self) -> str:
        if self._prompt_path.is_file():
            try:
                return self._prompt_path.read_text(encoding="utf-8").strip()
            except Exception as exc:
                logger.warning("Could not read prompt from %s: %s", self._prompt_path, exc)
        return "Analyze the image for visible surface skin categories."

    def _get_copy(self, lang_key: str) -> dict[str, Any]:
        # Fallback order: requested language -> english
        copy_data = self._messages.get(lang_key)
        if isinstance(copy_data, dict) and not self._is_placeholder_block(copy_data):
            return copy_data
        en_data = self._messages.get("en")
        if isinstance(en_data, dict):
            return en_data
        return {}

    @staticmethod
    def _is_placeholder_block(block: dict[str, Any]) -> bool:
        ref = block.get("mandatory_referral", "")
        if not isinstance(ref, str):
            return False
        return (
            "[GUJARATI_TRANSLATION_REQUIRED]" in ref
            or "[HINDI_TRANSLATION_REQUIRED]" in ref
        )

    async def check(self, raw_bytes: bytes, language: str = "en") -> ImageCheckResponse:
        """Process an uploaded image safely via metadata stripping, observation, and guard."""
        if not self._enabled:
            raise ImageCheckDisabledError("Image check is currently disabled.")

        clean_bytes, _ = sanitize_and_prepare_image(
            raw_bytes,
            max_file_size_bytes=self._max_file_size_bytes,
            max_dimension=self._max_dimension,
        )

        prompt = self._load_prompt()
        try:
            analysis_result = await self._analyzer.analyze(clean_bytes, prompt)
        except Exception as exc:
            logger.warning("Image analyzer invocation failed: %s", exc)
            analysis_result = ImageAnalysisResult(status=ImageCheckStatus.UNAVAILABLE, findings=[])

        # Explicit buffer cleanup
        del clean_bytes

        # Strict validation
        status = analysis_result.status
        findings = [f for f in analysis_result.findings if f in ALL_ALLOWED_CATEGORIES]

        if status == ImageCheckStatus.OK:
            if not findings:
                findings = ["none_visible"]
            elif "not_a_breast_photo" in findings:
                status = ImageCheckStatus.NOT_A_BREAST_PHOTO
                findings = []
            elif "unclear_image" in findings:
                status = ImageCheckStatus.UNCLEAR_IMAGE
                findings = []

        # Result Guard: construct final output using only human-reviewed strings
        copy_data = self._get_copy(language)
        referral_text = copy_data.get(
            "mandatory_referral",
            (
                "Please consult a medical doctor or visit your nearest primary health centre"
                " for an in-person clinical examination."
            ),
        )
        disclaimer_text = copy_data.get(
            "educational_disclaimer",
            (
                "This informational tool does not provide a diagnosis"
                " and cannot detect or rule out breast cancer."
            ),
        )

        outcomes_copy = copy_data.get("outcomes", {})
        summary_text = ""

        if status == ImageCheckStatus.OK:
            ok_copy = outcomes_copy.get("ok", {})
            if "none_visible" in findings:
                summary_text = ok_copy.get(
                    "none_visible",
                    "No visible surface skin changes were identified in this photograph.",
                )
            else:
                summary_text = ok_copy.get(
                    "findings_noted",
                    "One or more observable surface features were noted in the photograph.",
                )
        elif status == ImageCheckStatus.UNCLEAR_IMAGE:
            summary_text = outcomes_copy.get("unclear_image", {}).get(
                "summary",
                "The photograph is too blurry, dark, or unclear to evaluate surface features.",
            )
        elif status == ImageCheckStatus.NOT_A_BREAST_PHOTO:
            summary_text = outcomes_copy.get("not_a_breast_photo", {}).get(
                "summary",
                "The submitted photo does not appear to show breast skin.",
            )
        elif status == ImageCheckStatus.UNAVAILABLE:
            summary_text = copy_data.get(
                "could_not_check",
                outcomes_copy.get("unavailable", {}).get(
                    "summary",
                    "Image Check is currently unavailable.",
                ),
            )
        else:  # Error
            summary_text = outcomes_copy.get("error", {}).get(
                "summary",
                "An error occurred while evaluating the image.",
            )

        return ImageCheckResponse(
            status=status,
            findings=findings,
            referral_required=True,  # Always true across 100% of outcomes
            summary_message=summary_text,
            referral_message=referral_text,
            educational_disclaimer=disclaimer_text,
        )
