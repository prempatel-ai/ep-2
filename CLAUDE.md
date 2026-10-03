# CLAUDE.md

Guidance for Claude (and any coding agent) working in this repository. Read this first, then `agent.md`.

## What this is

Sahayak: an offline Gujarati/Hindi/English voice and text assistant for verified breast cancer FAQs.
Python backend (built), web frontend (to build). Read, in order: `product.md` → `memory.md` → `phases.md`.

## Where things are

```
backend/            Python service (FastAPI). Built and tested.
  src/sahayak/
    domain/         plain types + ports (interfaces)
    services/       all logic. NO web or model-library imports here
    adapters/       one file per external library/model, behind a port
    api/            routes, request schemas, wire serialisation
    container.py    the only place adapters are chosen
    config.py       typed settings (SAHAYAK_* env vars)
  tests/            unittest-style, runs without models or network
frontend/           web UI (created in Phase 4)
product.md  memory.md  phases.md  agent.md  CLAUDE.md
```

## Commands

```bash
# backend (from backend/)
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"                      # add extras as needed: rag, stt-whisper, tts-mms ...
PYTHONPATH=src python -m unittest discover -s tests     # or: pytest
python -m sahayak                            # run server (uses .env)
sahayak-index                                # build FAQ index from data/faqs.jsonl
ruff check src tests && mypy                 # lint and types, when installed

# no model yet:  SAHAYAK_LLM__BACKEND=echo   (placeholder model for UI work)
# text only:     SAHAYAK_STT__BACKEND=disabled SAHAYAK_TTS__BACKEND=disabled
```

## Architecture rules (do not break)

1. `services/` and `domain/` never import from `adapters/`, `api/`, FastAPI, httpx, torch, or any model library.
2. A new external model or library means a new adapter behind an existing port, chosen only in `container.py`.
3. Heavy imports (`torch`, `transformers`, `chromadb`, ...) happen **inside** adapter methods, so optional extras stay optional.
4. Blocking model calls go through `core/blocking.BlockingRunner` (one worker thread per model). Never block the event loop.
5. Async generators that wrap other async generators use `contextlib.aclosing`.
6. Never log user text or answers. Log timings, counts, error classes.
7. Errors that reach clients subclass `SahayakError` with a stable `code`.
8. The wire protocol (`api/serialization.py`, `api/schemas.py`, `backend/README.md`) is a contract with the frontend. Change all three and the frontend types together, or not at all.

## Code style

- Python 3.11+, type hints everywhere, `from __future__ import annotations`.
- Small modules with a docstring saying what and why. Comments explain *why*, not *what*.
- No dead code, no commented-out code, no placeholder `TODO`s left in finished work. If something is deferred, write it in `memory.md` under *Open decisions* instead.
- Frontend: TypeScript strict. No `any` without a comment. Components small and named for what they show.
- Prefer boring, readable code over clever code.

## Tests

- Every service change has a test. Tests use fakes from `backend/tests/fakes.py`, not real models.
- Run the full suite before saying a task is done. Report the actual count and result.
- Adapters that need real models are verified by a runnable smoke script, not by mocking the library.

## Honesty rules (this project is health-related)

- Say what you ran and what you did not. Mark anything unrun as **UNVERIFIED**.
- Never invent model names, package versions, flags, or API signatures. If unsure, check the library's docs or model card and say so, or ask.
- Never write, rewrite, or "improve" medical content, safety patterns, or helpline numbers. Flag them for human review.
- Do not claim latency, accuracy or safety properties that have not been measured.

## Working on a phase

Follow `phases.md`. One phase at a time. Finish its acceptance checks, update `memory.md`, then stop and report. Do not start the next phase without the user's go-ahead.
