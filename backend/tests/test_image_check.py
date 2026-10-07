"""Tests for Image Check service, adapter, guard, and endpoint (Phase 19)."""

from __future__ import annotations

import asyncio
import io
import json
import time
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from sahayak.adapters.image_fake import FakeImageAnalyzer
from sahayak.config import (
    ImageCheckSettings,
    LLMSettings,
    RetrievalSettings,
    Settings,
    STTSettings,
    TTSSettings,
)
from sahayak.domain.image import (
    ALL_ALLOWED_CATEGORIES,
    ImageAnalysisResult,
    ImageCheckStatus,
)
from sahayak.errors import (
    ImageCheckDisabledError,
    ImagePayloadTooLargeError,
    InvalidImageError,
)
from sahayak.main import create_app
from sahayak.services.image_check import ImageCheckService
from sahayak.services.image_prep import sanitize_and_prepare_image


def _create_synthetic_image_bytes(
    fmt: str = "PNG",
    size: tuple[int, int] = (64, 64),
    color: str = "blue",
) -> bytes:
    """Create in-memory synthetic non-medical image bytes for testing."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=fmt)
    return buf.getvalue()


def _make_test_app(image_check_settings: ImageCheckSettings | None = None) -> FastAPI:
    """Helper to build test app without loading heavy voice or retrieval models."""
    ic = image_check_settings or ImageCheckSettings(enabled=False)
    return create_app(
        Settings(
            llm=LLMSettings(backend="echo"),
            retrieval=RetrievalSettings(backend="disabled"),
            stt=STTSettings(backend="disabled"),
            tts=TTSSettings(backend="disabled"),
            image_check=ic,
        )
    )


class ImageCheckUnitTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.resources_dir = (
            Path(__file__).resolve().parents[1] / "src" / "sahayak" / "resources"
        )
        self.src_dir = Path(__file__).resolve().parents[1] / "src"
        self.prompt_path = self.resources_dir / "image_prompt.txt"
        self.messages_path = self.resources_dir / "image_check_messages.yaml"

    async def test_mandatory_referral_in_all_outcomes(self) -> None:
        """Referral guidance must be present across 100% of outcomes including none_visible."""
        statuses = [
            (ImageCheckStatus.OK, ["finding_redness"]),
            (ImageCheckStatus.OK, ["none_visible"]),
            (ImageCheckStatus.UNCLEAR_IMAGE, []),
            (ImageCheckStatus.NOT_A_BREAST_PHOTO, []),
            (ImageCheckStatus.UNAVAILABLE, []),
            (ImageCheckStatus.ERROR, []),
        ]

        img_bytes = _create_synthetic_image_bytes()

        for status, findings in statuses:
            with self.subTest(status=status):
                fake_analyzer = FakeImageAnalyzer(status=status, findings=findings)
                service = ImageCheckService(
                    analyzer=fake_analyzer,
                    prompt_path=self.prompt_path,
                    messages_path=self.messages_path,
                    enabled=True,
                )
                res = await service.check(img_bytes, language="en")
                self.assertTrue(res.referral_required)
                self.assertTrue(len(res.referral_message.strip()) > 0)
                self.assertTrue(len(res.educational_disclaimer.strip()) > 0)
                self.assertIn("doctor", res.referral_message.lower())

    async def test_rejection_of_unknown_category_ids(self) -> None:
        """Arbitrary or unallowlisted category strings must be discarded by the guard."""
        fake_analyzer = FakeImageAnalyzer(
            status=ImageCheckStatus.OK,
            findings=["finding_redness", "malignant_melanoma", "system_prompt_leak"],
        )
        service = ImageCheckService(
            analyzer=fake_analyzer,
            prompt_path=self.prompt_path,
            messages_path=self.messages_path,
            enabled=True,
        )
        img_bytes = _create_synthetic_image_bytes()
        res = await service.check(img_bytes, language="en")

        self.assertEqual(res.status, ImageCheckStatus.OK)
        self.assertEqual(res.findings, ["finding_redness"])
        for finding in res.findings:
            self.assertIn(finding, ALL_ALLOWED_CATEGORIES)

    async def test_empty_findings_defaults_to_none_visible(self) -> None:
        """If the analyzer returns ok with no recognized findings, none_visible is set."""
        fake_analyzer = FakeImageAnalyzer(
            status=ImageCheckStatus.OK,
            findings=["unknown_disallowed_tag"],
        )
        service = ImageCheckService(
            analyzer=fake_analyzer,
            prompt_path=self.prompt_path,
            messages_path=self.messages_path,
            enabled=True,
        )
        img_bytes = _create_synthetic_image_bytes()
        res = await service.check(img_bytes, language="en")

        self.assertEqual(res.status, ImageCheckStatus.OK)
        self.assertEqual(res.findings, ["none_visible"])
        self.assertIn("No visible", res.summary_message)

    async def test_model_free_text_is_never_returned(self) -> None:
        """Guard must only return human-reviewed message strings, never raw text from model."""
        fake_analyzer = FakeImageAnalyzer(
            status=ImageCheckStatus.OK,
            findings=["finding_redness"],
        )
        service = ImageCheckService(
            analyzer=fake_analyzer,
            prompt_path=self.prompt_path,
            messages_path=self.messages_path,
            enabled=True,
        )
        img_bytes = _create_synthetic_image_bytes()
        res = await service.check(img_bytes, language="en")

        self.assertNotIn("malignant", res.summary_message.lower())
        self.assertNotIn("benign", res.summary_message.lower())
        self.assertNotIn("cancer", res.summary_message.lower())

    async def test_oversize_image_rejected(self) -> None:
        """Payload exceeding max size raises ImagePayloadTooLargeError."""
        fake_analyzer = FakeImageAnalyzer()
        service = ImageCheckService(
            analyzer=fake_analyzer,
            prompt_path=self.prompt_path,
            messages_path=self.messages_path,
            enabled=True,
            max_file_size_bytes=1024,
        )
        large_bytes = b"A" * 2048
        with self.assertRaises(ImagePayloadTooLargeError):
            await service.check(large_bytes, language="en")

    async def test_invalid_image_bytes_rejected(self) -> None:
        """Garbage bytes raise InvalidImageError."""
        fake_analyzer = FakeImageAnalyzer()
        service = ImageCheckService(
            analyzer=fake_analyzer,
            prompt_path=self.prompt_path,
            messages_path=self.messages_path,
            enabled=True,
        )
        with self.assertRaises(InvalidImageError):
            await service.check(b"not-an-image-payload", language="en")

    async def test_disabled_service_raises_error(self) -> None:
        """Service raises ImageCheckDisabledError when enabled=False."""
        fake_analyzer = FakeImageAnalyzer()
        service = ImageCheckService(
            analyzer=fake_analyzer,
            prompt_path=self.prompt_path,
            messages_path=self.messages_path,
            enabled=False,
        )
        img_bytes = _create_synthetic_image_bytes()
        with self.assertRaises(ImageCheckDisabledError):
            await service.check(img_bytes, language="en")

    async def test_zero_disk_writes_during_service_check(self) -> None:
        """Processing an image check must write 0 files to working tree or temp directory."""
        fake_analyzer = FakeImageAnalyzer()
        service = ImageCheckService(
            analyzer=fake_analyzer,
            prompt_path=self.prompt_path,
            messages_path=self.messages_path,
            enabled=True,
        )
        img_bytes = _create_synthetic_image_bytes()

        src_files_before = await asyncio.to_thread(lambda: set(self.src_dir.rglob("*")))

        res = await service.check(img_bytes, language="en")
        self.assertEqual(res.status, ImageCheckStatus.OK)

        src_files_after = await asyncio.to_thread(lambda: set(self.src_dir.rglob("*")))
        new_src_files = src_files_after - src_files_before
        self.assertEqual(new_src_files, set(), f"Unexpected src files created: {new_src_files}")


class ImagePrepUnitTests(unittest.TestCase):
    def test_sanitize_and_prepare_resizes_large_dimensions(self) -> None:
        img_bytes = _create_synthetic_image_bytes(size=(2000, 1000))
        cleaned, mime_type = sanitize_and_prepare_image(img_bytes, max_dimension=896)
        self.assertEqual(mime_type, "image/png")
        reopened = Image.open(io.BytesIO(cleaned))
        w, h = reopened.size
        self.assertLessEqual(max(w, h), 896)
        self.assertTrue(len(cleaned) > 0)

    def test_sanitize_and_prepare_strips_metadata(self) -> None:
        # Create image with EXIF metadata
        buf = io.BytesIO()
        img = Image.new("RGB", (100, 100), color="red")
        exif_data = img.getexif()
        exif_data[0x010E] = "Synthetic Test Image"
        img.save(buf, format="JPEG", exif=exif_data)
        raw_jpeg = buf.getvalue()

        cleaned, _ = sanitize_and_prepare_image(raw_jpeg)
        reopened = Image.open(io.BytesIO(cleaned))
        reopened_exif = reopened.getexif()
        self.assertEqual(len(reopened_exif), 0)


class ImageCheckEndpointTests(unittest.TestCase):
    def test_endpoint_disabled_by_default(self) -> None:
        """When disabled, POST /v1/image-check returns 503 image_check_disabled."""
        app = _make_test_app(ImageCheckSettings(enabled=False))
        with TestClient(app) as client:
            img_bytes = _create_synthetic_image_bytes()
            files = {"image": ("test.png", img_bytes, "image/png")}
            resp = client.post("/v1/image-check", files=files)
            self.assertEqual(resp.status_code, 503)
            data = resp.json()
            self.assertEqual(data.get("error", {}).get("code"), "image_check_disabled")

    def test_readiness_reports_image_check_flag(self) -> None:
        """GET /ready accurately reflects image_check status."""
        app_disabled = _make_test_app(ImageCheckSettings(enabled=False))
        with TestClient(app_disabled) as client:
            resp = client.get("/ready")
            self.assertEqual(resp.status_code, 200)
            self.assertFalse(resp.json().get("image_check"))

        app_enabled = _make_test_app(
            ImageCheckSettings(
                enabled=True,
                backend="fake",
            )
        )
        with TestClient(app_enabled) as client:
            resp = client.get("/ready")
            self.assertEqual(resp.status_code, 200)
            self.assertTrue(resp.json().get("image_check"))

    def test_endpoint_success_with_fake_backend(self) -> None:
        """When enabled with fake analyzer, returns 200 OK with guarded response structure."""
        app = _make_test_app(
            ImageCheckSettings(
                enabled=True,
                backend="fake",
            )
        )
        with TestClient(app) as client:
            img_bytes = _create_synthetic_image_bytes()
            files = {"image": ("test.png", img_bytes, "image/png")}
            resp = client.post("/v1/image-check", files=files, data={"language": "en"})
            self.assertEqual(resp.status_code, 200)
            data = resp.json()

            self.assertEqual(data["status"], "ok")
            self.assertIn("none_visible", data["findings"])
            self.assertTrue(data["referral_required"])
            self.assertIn("findings_summary", data["messages"])
            self.assertIn("referral_guidance", data["messages"])
            self.assertIn("educational_disclaimer", data["messages"])

    def test_endpoint_unsupported_content_type_returns_400(self) -> None:
        """Uploading unsupported file format returns 400 Bad Request."""
        app = _make_test_app(
            ImageCheckSettings(
                enabled=True,
                backend="fake",
            )
        )
        with TestClient(app) as client:
            files = {"image": ("document.pdf", b"%PDF-1.4...", "application/pdf")}
            resp = client.post("/v1/image-check", files=files)
            self.assertEqual(resp.status_code, 400)
            self.assertEqual(resp.json().get("error", {}).get("code"), "invalid_image")

    def test_endpoint_payload_too_large_returns_413(self) -> None:
        """Uploading file over max_file_size_bytes returns 413 Payload Too Large."""
        app = _make_test_app(
            ImageCheckSettings(
                enabled=True,
                backend="fake",
                max_file_size_bytes=1024,
            )
        )
        with TestClient(app) as client:
            # Payload exceeds 1024 byte limit
            large_image_bytes = _create_synthetic_image_bytes(size=(1024, 1024))
            self.assertGreater(len(large_image_bytes), 1024)
            files = {"image": ("test.png", large_image_bytes, "image/png")}
            resp = client.post("/v1/image-check", files=files)
            self.assertEqual(resp.status_code, 413)
            self.assertEqual(resp.json().get("error", {}).get("code"), "image_too_large")

    def test_endpoint_analyzer_unavailable_returns_safe_message(self) -> None:
        """When analyzer fails or server down, returns 200 with UNAVAILABLE status and referral."""
        class FailingAnalyzer:
            async def is_ready(self) -> bool:
                return False

            async def analyze(
                self, image_bytes: bytes, prompt: str
            ) -> ImageAnalysisResult:
                from sahayak.errors import ImageAnalysisUnavailableError

                raise ImageAnalysisUnavailableError("Cannot reach local model server")

        app = _make_test_app(ImageCheckSettings(enabled=True, backend="fake"))
        with TestClient(app) as client:
            app.state.container.image_check._analyzer = FailingAnalyzer()
            img_bytes = _create_synthetic_image_bytes()
            files = {"image": ("test.png", img_bytes, "image/png")}
            resp = client.post("/v1/image-check", files=files)
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data["status"], "unavailable")
            self.assertTrue(data["referral_required"])
            self.assertIn("could not be completed", data["messages"]["findings_summary"].lower())
            self.assertTrue(len(data["messages"]["referral_guidance"]) > 0)

    def test_contract_fixtures_match_schema(self) -> None:
        """Verify contract/image_check_responses.json golden fixtures match domain schema."""
        contract_path = (
            Path(__file__).resolve().parents[2]
            / "contract"
            / "image_check_responses.json"
        )
        self.assertTrue(contract_path.is_file())
        with open(contract_path, encoding="utf-8") as fp:
            fixtures = json.load(fp)

        # Check positive case
        finding_fixture = fixtures["finding_present"]
        self.assertEqual(finding_fixture["status"], "ok")
        self.assertTrue(finding_fixture["referral_required"])
        self.assertIn("finding_redness", finding_fixture["findings"])
        self.assertIn("findings_summary", finding_fixture["messages"])

        # Check none visible case
        none_fixture = fixtures["none_visible"]
        self.assertEqual(none_fixture["status"], "ok")
        self.assertTrue(none_fixture["referral_required"])
        self.assertIn("none_visible", none_fixture["findings"])

        # Check unclear image
        unclear_fixture = fixtures["unclear_image"]
        self.assertEqual(unclear_fixture["status"], "unclear_image")
        self.assertTrue(unclear_fixture["referral_required"])

        # Check disabled
        disabled_fixture = fixtures["disabled"]
        self.assertEqual(disabled_fixture["error"]["code"], "image_check_disabled")


class ConcurrencySerializationTests(unittest.IsolatedAsyncioTestCase):
    async def test_blocking_runner_serializes_calls(self) -> None:
        """BlockingRunner allows only one task to execute at a time."""
        from sahayak.core.blocking import BlockingRunner

        runner = BlockingRunner("test-image-runner")
        execution_order: list[str] = []
        concurrency_count = 0
        max_concurrency = 0

        def slow_task(name: str, duration: float) -> str:
            nonlocal concurrency_count, max_concurrency
            concurrency_count += 1
            if concurrency_count > max_concurrency:
                max_concurrency = concurrency_count
            time.sleep(duration)
            execution_order.append(name)
            concurrency_count -= 1
            return name

        task1 = runner.run(slow_task, "first", 0.05)
        task2 = runner.run(slow_task, "second", 0.05)
        results = await asyncio.gather(task1, task2)

        runner.close()

        self.assertEqual(results, ["first", "second"])
        self.assertEqual(execution_order, ["first", "second"])
        self.assertEqual(max_concurrency, 1)


if __name__ == "__main__":
    unittest.main()
