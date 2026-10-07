# CLAUDE.md

Guidance for Claude (and any coding agent) working in this repository. Read this first, then `agent.md`.

## What this is

Sahayak: an offline Gujarati/Hindi/English voice and text assistant for verified breast cancer FAQs.
Python backend (built, tested) and web frontend (built through Phase 7: text chat, voice UI, design and accessibility).
Read, in order: `product.md` → `memory.md` → `phases.md`. The current phase is the first one not ticked in `phases.md`.

Active work after Phase 7 may include the **Voice v2 track** (Phases 11 to 16 in `phases.md`): making the voice
conversation feel more human through streaming input, better listening, faster and more natural speech, and honest
measurement. Everything below still applies to that track.

## Where things are

```
backend/            Python service (FastAPI). Built and tested.
  src/sahayak/
    domain/         plain types + ports (interfaces)
    services/       all logic. NO web or model-library imports here
    adapters/       one file per external library/model, behind a port
    api/            routes, request schemas, wire serialisation
    resources/      safety_rules.yaml, system_prompt.txt (human-reviewed content)
    container.py    the only place adapters are chosen
    config.py       typed settings (SAHAYAK_* env vars)
  tests/            unittest-style, runs without models or network
  scripts/          dev tools (smoke_http, ws_smoke, tts_listen, check_retrieval, dump_prompt, ...)
  eval/             probe and evaluation files; voice_clips/ is git-ignored (human-supplied test audio)
  data/             faqs.jsonl, chroma/, bench/, tts_samples/ (data and outputs are git-ignored where private)
frontend/           Next.js (App Router, static export) + TypeScript strict
  src/
    api/            types.ts http.ts sse.ts voiceSocket.ts voiceWire.ts
    audio/          recorder.ts (capture + VAD) player.ts (AudioQueuePlayer)
    features/       chat/ voice/ settings/
    components/     shared building blocks
    i18n/           en.ts gu.ts hi.ts index.ts
    styles/         tokens.css fonts.css base.css
  public/fonts/     self-hosted fonts and LICENSES.md
  scripts/          check-offline.mjs
  docs/             voice-checklist.md
contract/           voice_frames.json: golden wire frames read by BOTH backend and frontend tests
docs/               finetune-handoff.md, voice docs added by later phases
product.md  memory.md  phases.md  agent.md  CLAUDE.md
```

## Commands

```bash
# backend (from backend/)
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -e ".[dev]"                      # add extras as needed: rag, stt-whisper, tts-mms, stt-indic, tts-parler
PYTHONPATH=src python -m unittest discover -s tests     # or: pytest
python -m sahayak                            # run server (uses .env)
sahayak-index                                # build FAQ index from data/faqs.jsonl
ruff check src tests && mypy                 # lint and types, when installed

# frontend (from frontend/)
npm install
npm run dev                                  # dev server, proxies to backend on :8000
npm run typecheck && npm run lint && npm test
npm run build && npm run check:offline       # static export, then scan for external URLs

# useful backend modes
# no model yet:  SAHAYAK_LLM__BACKEND=echo   (placeholder model for UI work)
# text only:     SAHAYAK_STT__BACKEND=disabled SAHAYAK_TTS__BACKEND=disabled
# offline models: HF_HUB_OFFLINE=1           (after one-time downloads)

# voice tooling (from backend/, server running)
python scripts/ws_smoke.py --text "..." --language gu      # voice path smoke test
python scripts/tts_listen.py                               # synthesise fixed strings for listening
python scripts/voice_bench.py                              # latency over the clip set (Phase 11+)
```

## Architecture rules (do not break)

1. `services/` and `domain/` never import from `adapters/`, `api/`, FastAPI, httpx, torch, or any model library.
2. A new external model or library means a new adapter behind an existing port (or a new port in `domain/`), chosen only in `container.py`.
3. Heavy imports (`torch`, `transformers`, `chromadb`, ...) happen **inside** adapter methods, so optional extras stay optional.
4. Blocking model calls go through `core/blocking.BlockingRunner` (one worker thread per model). Never block the event loop.
5. Async generators that wrap other async generators use `contextlib.aclosing`.
6. Never log user text or answers. Log timings, counts, error classes.
7. Errors that reach clients subclass `SahayakError` with a stable `code`.
8. The wire protocol (`api/serialization.py`, `api/schemas.py`, `backend/README.md`, `frontend/src/api/types.ts`, `contract/voice_frames.json`) is a contract between backend and frontend. Change **all** of them together, with the human's approval, or not at all.
9. Every per-turn message and audio frame carries the client-assigned `turn`; the frontend ignores any message whose `turn` is not the current turn.

### Voice rules (Voice v2 track and any voice change)

10. **Keep the live audio path small.** Capture, voice activity detection, frame sending and playback do no heavy work and never wait on retrieval, the LLM, or logging. Slow work happens behind queues so it can delay its own result but never stall audio.
11. **Never answer from a partial transcript.** Streaming STT may produce partial text for display and for warming or prefetching, but the safety guard and the answer decision run on the **final** transcript only. If a prefetch used a partial that differs from the final, discard it.
12. **Provisional vs final.** The UI may show provisional text (partial transcript, sentence being spoken). The authoritative record in session history is only the final transcript and the assistant text the user actually heard. Do not claim finer granularity than is implemented and tested.
13. **Interruption must always win.** Speech start during playback flushes audio immediately and cancels the active turn. Short sounds and backchannels must not interrupt; thresholds are settings, with defaults chosen from measurement.
14. **Old behaviour stays available behind a setting** until the new path is verified on real hardware (for example the one-blob utterance path while streaming input is introduced).
15. **Acknowledgement and filler speech** (anything spoken while the model is slow) comes from a separate reviewable file of human-supplied phrases. It never plays on the safety path or the verbatim FAQ path, and contains no medical content.
16. **No audio or transcripts are ever saved at runtime.** Test clips are human-supplied, live in git-ignored `backend/eval/voice_clips/`, and are used by developer tools only.
17. **Offline always.** VAD models, WASM files, worklets, fonts and any other asset load from the bundle with the network off. No CDN, no remote model fetch at runtime.

## Code style

- Python 3.11+, type hints everywhere, `from __future__ import annotations`.
- Small modules with a docstring saying what and why. Comments explain *why*, not *what*.
- No dead code, no commented-out code, no placeholder `TODO`s left in finished work. If something is deferred, write it in `memory.md` under *Open decisions* instead.
- Frontend: TypeScript strict. No `any` without a comment. Components small and named for what they show.
- Pure logic (state machines, reducers, stream parsers, wire encode and decode) stays free of browser APIs so it is unit-testable.
- Prefer boring, readable code over clever code.
- Do not use em dashes in documentation or user-facing text; use a colon, comma, or full stop.

## Tests

- Every service change has a test. Tests use fakes from `backend/tests/fakes.py`, not real models.
- Run the full suite before saying a task is done. Report the actual count and result.
- Adapters that need real models are verified by a runnable smoke script, not by mocking the library.
- Wire formats are covered by shared fixtures in `contract/`; backend and frontend tests read the same file.
- Frontend: Vitest + Testing Library, automated accessibility check (`vitest-axe`), `check:offline` after every build.
- Anything that depends on audio hardware, a real browser mic, headphones vs speakers, or a GPU is verified manually from `frontend/docs/voice-checklist.md` and marked **UNVERIFIED** until a human or a recorded run confirms it.
- Latency and accuracy claims need a recorded measurement: hardware, number of runs, spread, and a clear "met" or "not met" against `product.md` §8.

## Honesty rules (this project is health-related)

- Say what you ran and what you did not. Mark anything unrun as **UNVERIFIED**.
- Never invent model names, package versions, flags, or API signatures. If unsure, check the library's docs, installed source or model card and say so, or ask.
- Never write, rewrite, or "improve" medical content, safety patterns, or helpline numbers. Flag them for human review.
- Never write Gujarati or Hindi UI text, spoken phrases or safety wording. Use clearly marked `EXAMPLE` or `NEEDS HUMAN TRANSLATION` placeholders; a native speaker supplies the real text.
- Do not claim latency, accuracy, or safety properties that have not been measured.
- Do not describe the assistant as matching any commercial voice product. The Voice v2 track borrows system design ideas from public engineering write-ups, not their models.

## Working on a phase

Follow `phases.md`. One phase at a time. Finish its acceptance checks, update `memory.md`, then stop and report. Do not start the next phase without the user's go-ahead.
If the code, `memory.md`, `product.md` and `phases.md` disagree, stop and report the conflict instead of choosing silently.