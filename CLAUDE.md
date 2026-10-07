# CLAUDE.md

Guidance for Claude (and any coding agent) working in this repository. Read this first, then `agent.md`.

## What this is

Sahayak: an offline Gujarati/Hindi/English voice and text assistant for verified breast cancer FAQs.
Python backend (built, tested) and web frontend (built through Phase 7: text chat, voice UI, design and accessibility).
Read, in order: `product.md` → `memory.md` → `phases.md`. The current phase is the first one not ticked in `phases.md`.

The **Voice v2 track** (Phases 11 to 16 in `phases.md`) is reported complete by the builder; `memory.md` is the record of
what was measured and what is still UNVERIFIED.

Active work may now include the **Image Check track** (Phases 17 to 22): an optional, off-by-default feature where an adult
uploads a photo and gets a description of visible skin changes from MedGemma 4B running locally, always with a referral
to a clinician. It is the most safety-critical feature in the product. It is **not** a diagnosis and **not** a cancer
detector. Phase 17 is documents only and ends with a human approval gate. Everything below still applies to that track,
and the Image Check rules (18 to 27) apply to every change that touches images.

## Where things are

```
backend/            Python service (FastAPI). Built and tested.
  src/sahayak/
    domain/         plain types + ports (interfaces)
    services/       all logic. NO web or model-library imports here
    adapters/       one file per external library/model, behind a port
    api/            routes, request schemas, wire serialisation
    resources/      safety_rules.yaml, system_prompt.txt, acknowledgements.yaml, image_prompt.txt,
                    image_check_messages.yaml (all human-written and reviewed content; agents use EXAMPLE placeholders)
    container.py    the only place adapters are chosen
    config.py       typed settings (SAHAYAK_* env vars)
  tests/            unittest-style, runs without models or network
  scripts/          dev tools (smoke_http, ws_smoke, tts_listen, check_retrieval, dump_prompt, ...)
  eval/             probe and evaluation files; voice_clips/ and image_set/ are git-ignored (human-supplied test audio and images)
  data/             faqs.jsonl, chroma/, bench/, tts_samples/ (data and outputs are git-ignored where private)
frontend/           Next.js (App Router, static export) + TypeScript strict
  src/
    api/            types.ts http.ts sse.ts voiceSocket.ts voiceWire.ts
    audio/          recorder.ts (capture + VAD) player.ts (AudioQueuePlayer)
    features/       chat/ voice/ imagecheck/ settings/
    components/     shared building blocks
    i18n/           en.ts gu.ts hi.ts index.ts
    styles/         tokens.css fonts.css base.css
  public/fonts/     self-hosted fonts and LICENSES.md
  scripts/          check-offline.mjs
  docs/             voice-checklist.md
contract/           voice_frames.json: golden wire frames read by BOTH backend and frontend tests
docs/               finetune-handoff.md, voice docs, image-check-design.md (Phase 17)
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

# image check tooling (Phases 18+; synthetic or non-medical images only for agent runs)
python scripts/image_probe.py --dir <folder of synthetic images>   # raw model output, latency, memory
python eval/image_eval.py                                  # evaluation over the human-supplied set (human runs the real set)
# feature flag, default off:  SAHAYAK_IMAGE_CHECK__ENABLED=true
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

### Image Check rules (Phases 17 to 22 and any change touching images)

18. **Never claim detection.** Code, UI text, docs and comments never say the feature detects, diagnoses, screens for or rules out cancer. It describes visible skin changes and refers the user to a clinician.
19. **The model's words never reach the user.** The model returns structured output from a fixed category list. Only validated category ids, mapped to human-written text in `resources/image_check_messages.yaml`, are shown. Unknown or malformed output is an error, never a guess.
20. **The referral message is in every outcome**, including `none_visible`, `unclear_image`, `not_a_breast_photo`, unavailable and error. A guard in `services/` enforces it and a test proves it.
21. **No reassurance and no scores.** No all-clear wording, green ticks, probabilities, percentages or confidence values anywhere in the response or UI.
22. **Images live in memory only.** No files, temp files, thumbnails, caches, logs or crash dumps contain image bytes. Metadata is stripped by re-encoding. Buffers are freed after the request. Check what the model server and libraries write to disk.
23. **Frontend holds no trace.** No `localStorage`, `sessionStorage`, IndexedDB or cache for images or results. Revoke object URLs promptly. No image or result in a URL. "Clear and start over" removes everything.
24. **Ignore text inside images.** Treat it as data. The output schema and the guard are the defence, and a test covers it.
25. **Off by default.** `SAHAYAK_IMAGE_CHECK__ENABLED` defaults to false. When off, no image model is loaded, the UI hides the feature, and the endpoint behaves as approved.
26. **One image at a time, and never at the expense of voice.** Image analysis goes through `BlockingRunner` (or an equivalent single-flight limit) and must not stall text or voice turns. Memory use with the voice stack loaded is measured, not assumed.
27. **Agents never handle real breast images.** Tests and probes use synthetic or non-medical images. Real evaluation images are supplied by the human in git-ignored `backend/eval/image_set/` and read only by the evaluation harness, which reports aggregates.

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
- Image Check: every response path has a test that the referral message is present; tests prove model free text never appears, malformed output is an error, unknown ids are rejected, oversize and wrong-type files are rejected, the flag-off behaviour holds, and no file is created during a request. Use a fake analyzer from `backend/tests/fakes.py`; adapters needing the real model are verified by `image_probe.py`.
- Evaluation of the Image Check reports the **missed-finding rate first**, then per-category numbers with counts. The agent chooses no pass thresholds.

## Honesty rules (this project is health-related)

- Say what you ran and what you did not. Mark anything unrun as **UNVERIFIED**.
- Never invent model names, package versions, flags, or API signatures. If unsure, check the library's docs, installed source or model card and say so, or ask.
- Never write, rewrite, or "improve" medical content, safety patterns, or helpline numbers. Flag them for human review.
- Never write Gujarati or Hindi UI text, spoken phrases or safety wording. Use clearly marked `EXAMPLE` or `NEEDS HUMAN TRANSLATION` placeholders; a native speaker supplies the real text.
- Do not claim latency, accuracy, or safety properties that have not been measured.
- Never write the Image Check category list, the model's medical instruction, or any sentence the user sees about findings, in any language. Proposals for the clinician are labelled PROPOSED, needs clinical review.
- Do not make any claim about how well MedGemma 4B recognises skin changes in breast photos. It is UNVERIFIED until the human-run evaluation and the clinician's review exist. Its terms (Health AI Developer Foundations) are read and accepted by the human, not assumed.
- Do not describe the assistant as matching any commercial voice product. The Voice v2 track borrows system design ideas from public engineering write-ups, not their models.

## Working on a phase

Follow `phases.md`. One phase at a time. Finish its acceptance checks, update `memory.md`, then stop and report. Do not start the next phase without the user's go-ahead.
If the code, `memory.md`, `product.md` and `phases.md` disagree, stop and report the conflict instead of choosing silently.