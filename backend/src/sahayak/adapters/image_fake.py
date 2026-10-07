"""Fake image analyzer adapter for deterministic testing."""

from __future__ import annotations

from sahayak.domain.image import ImageAnalysisResult, ImageCheckStatus


class FakeImageAnalyzer:
    """Fake analyzer returning canned observation outcomes without executing models."""

    def __init__(
        self,
        *,
        status: ImageCheckStatus = ImageCheckStatus.OK,
        findings: list[str] | None = None,
        ready: bool = True,
    ) -> None:
        self.status = status
        self.findings = findings if findings is not None else ["none_visible"]
        self.ready = ready
        self.calls: list[tuple[bytes, str]] = []

    async def is_ready(self) -> bool:
        return self.ready

    async def analyze(self, image_bytes: bytes, prompt: str) -> ImageAnalysisResult:
        self.calls.append((image_bytes, prompt))
        return ImageAnalysisResult(status=self.status, findings=list(self.findings))
