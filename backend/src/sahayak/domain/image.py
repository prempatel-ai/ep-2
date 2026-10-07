"""Domain models and status definitions for Image Check."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class ImageCheckStatus(StrEnum):
    """Possible outcomes of an image check."""

    OK = "ok"
    UNCLEAR_IMAGE = "unclear_image"
    NOT_A_BREAST_PHOTO = "not_a_breast_photo"
    UNAVAILABLE = "unavailable"
    ERROR = "error"


# PROPOSED starting category list from phases.md Phase 17
# Needs clinical review. The clinician decides D18.
PROPOSED_FINDING_CATEGORIES: tuple[str, ...] = (
    "finding_redness",
    "finding_skin_thickening",
    "finding_dimpling",
    "finding_scaling",
    "finding_nipple_change",
    "finding_visible_lump_or_shape_difference",
    "finding_open_sore",
)

PROPOSED_NON_FINDING_CATEGORIES: tuple[str, ...] = (
    "none_visible",
    "unclear_image",
    "not_a_breast_photo",
)

ALL_ALLOWED_CATEGORIES: frozenset[str] = frozenset(
    PROPOSED_FINDING_CATEGORIES + PROPOSED_NON_FINDING_CATEGORIES
)


@dataclass(frozen=True)
class ImageAnalysisResult:
    """Raw observation result produced by the model adapter."""

    status: ImageCheckStatus
    findings: list[str] = field(default_factory=list)
    observation_text: str = ""


@dataclass(frozen=True)
class ImageCheckResponse:
    """User-facing structured response returned by the Image Check service."""

    status: ImageCheckStatus
    findings: list[str]
    referral_required: bool
    summary_message: str
    referral_message: str
    educational_disclaimer: str
    observation_notes: str = ""
