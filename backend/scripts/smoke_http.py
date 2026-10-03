"""Smoke checks for the Sahayak HTTP API (Phase 0).

Standard library only: uses urllib.request and http.client.
Verifies all Phase 0 HTTP acceptance checks against a running server.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any

BASE_URL = "http://127.0.0.1:8000"


def request_json(
    method: str, path: str, body: dict[str, Any] | None = None
) -> tuple[int, dict[str, Any] | list[Any] | str, dict[str, str]]:
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            resp_headers = dict(resp.getheaders())
            raw = resp.read().decode("utf-8")
            try:
                parsed = json.loads(raw) if raw else ""
            except Exception:
                parsed = raw
            return status, parsed, resp_headers
    except urllib.error.HTTPError as exc:
        status = exc.code
        resp_headers = dict(exc.headers.items())
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else ""
        except Exception:
            parsed = raw
        return status, parsed, resp_headers


def request_sse(
    path: str, body: dict[str, Any]
) -> tuple[int, list[tuple[str, dict[str, Any]]]]:
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        status = resp.status
        events: list[tuple[str, dict[str, Any]]] = []
        current_event: str | None = None
        current_data: str | None = None
        for raw_line in resp:
            line = raw_line.decode("utf-8").rstrip("\r\n")
            if line.startswith("event: "):
                current_event = line[7:]
            elif line.startswith("data: "):
                current_data = line[6:]
            elif not line:
                if current_event is not None and current_data is not None:
                    events.append((current_event, json.loads(current_data)))
                current_event = None
                current_data = None
        return status, events


def main() -> int:
    checks_passed = 0
    checks_total = 0

    def check(name: str, passed: bool, detail: str = "") -> None:
        nonlocal checks_passed, checks_total
        checks_total += 1
        if passed:
            checks_passed += 1
            print(f"PASS: {name}")
        else:
            print(f"FAIL: {name} - {detail}")

    # 1. GET /health
    try:
        status, data, _ = request_json("GET", "/health")
        passed = status == 200 and isinstance(data, dict) and data.get("status") == "ok"
        check("GET /health -> 200 ok", passed, f"status={status}, data={data}")
    except Exception as exc:
        check("GET /health -> 200 ok", False, str(exc))

    # 2. GET /ready
    try:
        status, data, _ = request_json("GET", "/ready")
        passed = status == 200 and isinstance(data, dict) and data.get("ready") is True
        check("GET /ready -> 200 ready:true", passed, f"status={status}, data={data}")
    except Exception as exc:
        check("GET /ready -> 200 ready:true", False, str(exc))

    # 3. GET /v1/config
    try:
        status, data, _ = request_json("GET", "/v1/config")
        langs = (
            [lang.get("code") for lang in data.get("languages", [])]
            if isinstance(data, dict)
            else []
        )
        passed = (
            status == 200
            and isinstance(data, dict)
            and set(langs) == {"gu", "hi", "en"}
            and data.get("voice") is False
        )
        check(
            "GET /v1/config -> langs [gu, hi, en], voice:false",
            passed,
            f"status={status}, data={data}",
        )
    except Exception as exc:
        check("GET /v1/config -> langs [gu, hi, en], voice:false", False, str(exc))

    # 4. POST /v1/chat with {"text":"hello"}
    chat_session_id: str | None = None
    try:
        status, events = request_sse("/v1/chat", {"text": "hello"})
        event_types = [e[0] for e in events]
        passed = (
            status == 200
            and len(events) >= 3
            and event_types[0] == "session"
            and "sentence" in event_types
            and event_types[-1] == "done"
        )
        sentence_sources = [
            payload.get("source") for name, payload in events if name == "sentence"
        ]
        if passed and all(s == "model" for s in sentence_sources):
            check("POST /v1/chat hello -> session, sentence (model), done", True)
            chat_session_id = events[0][1].get("session_id")
        else:
            check(
                "POST /v1/chat hello -> session, sentence (model), done",
                False,
                f"events={events}",
            )
    except Exception as exc:
        check("POST /v1/chat hello -> session, sentence (model), done", False, str(exc))

    # 5. POST /v1/chat with safety guard case
    try:
        status, events = request_sse(
            "/v1/chat", {"text": "Do I have breast cancer?", "language": "en"}
        )
        sentence_events = [payload for name, payload in events if name == "sentence"]
        passed = (
            status == 200
            and len(sentence_events) >= 1
            and all(s.get("source") == "safety" for s in sentence_events)
        )
        check("POST /v1/chat safety guard -> source: safety", passed, f"events={events}")
    except Exception as exc:
        check("POST /v1/chat safety guard -> source: safety", False, str(exc))

    # 6. POST /v1/chat with blank text -> 422
    try:
        status, data, _ = request_json("POST", "/v1/chat", {"text": "   "})
        passed = status == 422
        check("POST /v1/chat blank text -> 422", passed, f"status={status}, data={data}")
    except Exception as exc:
        check("POST /v1/chat blank text -> 422", False, str(exc))

    # 7. DELETE /v1/sessions/<id> -> 204 then 404
    try:
        if chat_session_id:
            status1, _, _ = request_json("DELETE", f"/v1/sessions/{chat_session_id}")
            status2, _, _ = request_json("DELETE", f"/v1/sessions/{chat_session_id}")
            passed = status1 == 204 and status2 == 404
            check(
                "DELETE /v1/sessions/<id> -> 204, then 404",
                passed,
                f"first={status1}, second={status2}",
            )
        else:
            check(
                "DELETE /v1/sessions/<id> -> 204, then 404",
                False,
                "No session_id from chat check",
            )
    except Exception as exc:
        check("DELETE /v1/sessions/<id> -> 204, then 404", False, str(exc))

    print(f"\n{checks_passed}/{checks_total} checks passed.")
    return 0 if checks_passed == checks_total else 1


if __name__ == "__main__":
    sys.exit(main())
