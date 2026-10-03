"""Tests for FastAPI HTTP routes and WebSocket handlers (Phase 0)."""

from __future__ import annotations

import json
import unittest

from fastapi.testclient import TestClient

from sahayak.config import LLMSettings, RetrievalSettings, Settings, STTSettings, TTSSettings
from sahayak.main import create_app


class WebLayerTests(unittest.TestCase):
    app = create_app(
        Settings(
            llm=LLMSettings(backend="echo"),
            retrieval=RetrievalSettings(backend="disabled"),
            stt=STTSettings(backend="disabled"),
            tts=TTSSettings(backend="disabled"),
        )
    )

    def test_health(self) -> None:
        with TestClient(self.app) as client:
            resp = client.get("/health")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertEqual(data.get("status"), "ok")
            self.assertEqual(data.get("version"), "0.1.0")

    def test_ready_and_config(self) -> None:
        with TestClient(self.app) as client:
            ready = client.get("/ready")
            self.assertEqual(ready.status_code, 200)
            self.assertTrue(ready.json().get("ready"))
            self.assertEqual(ready.json().get("faq_entries"), 0)

            cfg = client.get("/v1/config")
            self.assertEqual(cfg.status_code, 200)
            data = cfg.json()
            langs = [lang["code"] for lang in data["languages"]]
            self.assertEqual(set(langs), {"gu", "hi", "en"})
            self.assertFalse(data["voice"])

    def test_chat_stream_and_session_delete(self) -> None:
        with TestClient(self.app) as client:
            # 1. Echo chat
            resp = client.post("/v1/chat", json={"text": "hello"})
            self.assertEqual(resp.status_code, 200)
            lines = [line.strip() for line in resp.text.split("\n") if line.strip()]
            data_events = [
                json.loads(line[6:]) for line in lines if line.startswith("data: ")
            ]
            self.assertGreaterEqual(len(data_events), 3)
            self.assertEqual(data_events[0]["type"], "session")
            session_id = data_events[0]["session_id"]
            self.assertEqual(data_events[-1]["type"], "done")
            self.assertEqual(data_events[-1]["source"], "model")

            # 2. Safety guard chat
            safe_resp = client.post(
                "/v1/chat", json={"text": "Do I have breast cancer?", "language": "en"}
            )
            self.assertEqual(safe_resp.status_code, 200)
            safe_lines = [
                line.strip() for line in safe_resp.text.split("\n") if line.strip()
            ]
            safe_events = [
                json.loads(line[6:]) for line in safe_lines if line.startswith("data: ")
            ]
            sentences = [e for e in safe_events if e.get("type") == "sentence"]
            self.assertTrue(sentences)
            self.assertTrue(all(s.get("source") == "safety" for s in sentences))

            # 3. Blank text validation -> 422
            blank = client.post("/v1/chat", json={"text": "   "})
            self.assertEqual(blank.status_code, 422)

            # 4. Delete session -> 204 then 404
            del1 = client.delete(f"/v1/sessions/{session_id}")
            self.assertEqual(del1.status_code, 204)
            del2 = client.delete(f"/v1/sessions/{session_id}")
            self.assertEqual(del2.status_code, 404)

    def test_websocket_voice_text_turn(self) -> None:
        with (
            TestClient(self.app) as client,
            client.websocket_connect("/v1/voice") as ws,
        ):
            ready = ws.receive_json()
            self.assertEqual(ready.get("type"), "ready")
            self.assertFalse(ready.get("voice"))

            # Text turn without voice
            ws.send_json({"type": "text", "text": "hi", "speak": False})
            events = []
            while True:
                msg = ws.receive_json()
                events.append(msg)
                if msg.get("type") == "done":
                    break
            sentence_types = [e["type"] for e in events]
            self.assertIn("sentence", sentence_types)
            self.assertEqual(events[-1]["type"], "done")

            # Text turn with speak=True -> voice_unavailable error
            ws.send_json({"type": "text", "text": "hi", "speak": True})
            err = ws.receive_json()
            self.assertEqual(err.get("type"), "error")
            self.assertEqual(err.get("code"), "voice_unavailable")


if __name__ == "__main__":
    unittest.main()
