# Project memory

> Living record of **state, decisions, gotchas and open questions**. Agents read this at the start of
> every session and update it at the end of every phase. Keep it accurate and short; delete what is stale.
> Last updated: 2026-10-03.

## 1. Current state

| Area | State | Evidence |
|---|---|---|
| Backend code | Written | `backend/src/sahayak/` |
| Backend tests | **85 pass** (unittest/pytest, fakes + web layer) | `pytest` and `python -m unittest discover -s tests` |
| FastAPI routes, WebSocket handler | Verified on real hardware (Phase 0) | `backend/scripts/smoke_http.py`, `tests/test_web_layer.py` |
| Model adapters (Whisper, IndicConformer, MMS, Parler, sentence-transformers, Chroma, llama.cpp client) | Written, **UNVERIFIED** against real libraries | none yet |
| FAQ data / index | Not in repo | `backend/data/faqs.example.jsonl` shows the format |
| Frontend | Not started | n/a |
| Fine-tuned LLM | Owned by the builder; not part of agent work until Phase 10 | n/a |
| Clinical + native-speaker review | Not done | n/a |

**Phase progress:** Phase 0 complete (see `phases.md`).

## 2. Decisions and why

| Decision | Why |
|---|---|
| Layered: `domain` / `services` / `adapters` / `api`; services never import adapters | Models change fast; swapping one must be a config change, and logic must be testable without models. |
| LLM reached through an OpenAI-compatible HTTP endpoint (`llama-server`) | The fine-tuned model can be dropped in by changing a URL; no code coupling to llama.cpp. |
| Order of answering: safety guard → verbatim FAQ → model | Medical content: fixed replies for risky asks, verified text where it exists, generation last. |
| Verbatim FAQ when similarity ≥ `direct_threshold` (0.90 default, to be tuned) | Removes hallucination for common questions; fastest path. |
| Per-answer `source` label (`safety`/`faq`/`model`) | Provenance shown in the UI builds trust and aids evaluation. |
| Sentence-level streaming: segmenter → TTS per sentence while the model continues | Lowest time-to-first-audio without a speech-to-speech model. |
| One `BlockingRunner` thread per model | Inference libraries are not safe to call concurrently on one model; different models still overlap. |
| Sessions in memory only, TTL 30 min, deletable | Health conversations; nothing persisted. |
| Never log user text | Same reason. |
| Voice transport: browser does voice-activity detection and sends one PCM16 frame per utterance over a WebSocket | Keeps the server simple; works with any browser mic; no server-side mic. |
| **Client-assigned turn ids** on utterances, text messages, and every server message and audio frame | Prevents late frames from an interrupted reply being played in the next reply. Added after review of the protocol on 2026-10-03. |
| Safety rules in YAML, separate from code | Clinician can review them without reading Python. |
| Echo LLM backend | Lets the frontend be built and demoed before the real model exists. |
| UI must work fully offline (no CDN fonts/scripts/images) | Product requirement. |

## 3. Wire protocol (summary; full spec in `backend/README.md`)

- `POST /v1/chat` → SSE: `session`, `sentence`, `done`, `error`.
- `WS /v1/voice`: client sends optional `start`, binary utterances (`4-byte turn` + PCM16 16 kHz mono), `text`, `interrupt`. Server sends `ready`, `transcript`, `sentence`, binary audio (`turn`+`index`+WAV), `done`, `no_speech`, `interrupted`, `error`. Every per-turn message carries `turn`.
- `GET /v1/config`, `GET /ready`, `GET /health`, `DELETE /v1/sessions/{id}`.
- Frontend rule: ignore any message whose `turn` is not the current turn.

## 4. Unverified items (must be confirmed on real hardware)

1. **[VERIFIED in Phase 0]** Server starts; `/ready`, `/v1/config`, `/v1/chat`, `/v1/voice` behave as documented with echo model & disabled services. Real model adapters remain to be verified (Phase 2, 3).
2. `faster-whisper` call shape, including `info.all_language_probs` fallback in `adapters/stt_whisper.py`.
3. `IndicConformer` call: `model(waveform, lang, decoder)` and `trust_remote_code` loading (`adapters/stt_indic_conformer.py`).
4. `MMS-TTS` (VITS) load and output sample rate (`adapters/tts_mms.py`).
5. `Indic Parler-TTS` generate call (`adapters/tts_parler.py`).
6. ChromaDB `PersistentClient`, `query` result shape, cosine distance → score (`adapters/faq_chroma.py`).
7. Whether llama.cpp supports the chosen base model's architecture for GGUF conversion (Phase 10).
8. All latency targets in `product.md` §8.
9. Hindi and Gujarati text in `safety_rules.yaml` and `services/messages.py`; helpline numbers (112, 14416).

## 5. Gotchas

- **Indic regex:** Python's `\b` misbehaves around Hindi/Gujarati vowel signs. Do not use `\b` in non-English safety patterns.
- **ZWJ (U+200D)** is part of Indic conjuncts. `textprep` deliberately keeps it. Do not "clean" it out.
- **Prompt format must equal the fine-tuning format** (`services/prompting.py`). Mismatch → rambling or wrong-format answers.
- **E5 embedding models** need `query: ` / `passage: ` prefixes; configured in settings, applied by the embedder adapter.
- **Whisper is weakest on Gujarati** and can confuse Hindi/Gujarati on short clips. The user picks the language in the UI; auto-detect is a fallback.
- **IndicConformer needs the language up front**; without one it uses the deployment default.
- **Echo/feedback:** the mic can hear the speaker and trigger "interruption". Use `echoCancellation` in `getUserMedia` and test with and without headphones.
- **Async generators** wrapping other async generators must use `contextlib.aclosing`, otherwise cancellation can leave locks or tasks behind. A test guards this.
- **One turn at a time per session**, enforced by `Session.lock`. A cancelled turn still records what was actually said.
- **Chroma add-batch limit** is a few thousand; the indexer adds in batches of 256.
- Python 3.11+ is required (`StrEnum`, `aclosing` behaviour relied on).

## 6. Open decisions

| # | Decision | Default until decided | Decide by |
|---|---|---|---|
| D1 | Frontend stack | React + Vite + TypeScript (strict), plain CSS with design tokens | Start of Phase 4 (**user to confirm**) |
| D2 | Base model for the fine-tune (Sarvam-1 2B vs Gemma 3 4B) | Builder's choice; backend is agnostic | Phase 10 |
| D3 | Train with retrieved FAQs in the prompt, or without? | Without; set `RETRIEVAL__CONTEXT_THRESHOLD=1.0` | Before fine-tuning |
| D4 | STT: Whisper vs IndicConformer | Whisper `small` | Phase 2 (measure on Gujarati) |
| D5 | TTS voice: MMS vs Indic Parler | MMS | Phase 2 (listening test) |
| D6 | How the built UI is served: separate dev server vs static files from the backend | Static from backend in production | Phase 8 |
| D7 | Browser voice-activity-detection library | Candidate: `@ricky0123/vad-web`, bundled locally. **Verify its API and offline asset loading before use.** | Phase 6 |
| D8 | UI language strings: who reviews Gujarati/Hindi wording | Builder + native speaker | Phase 7 |
| D9 | Licences: Sarvam-1 terms for intended use; FAQ source licences | Check before any public release | Phase 10 |
| D10 | Who is the clinical reviewer, and when | Unassigned | Before any real users |

## 7. Glossary

- **FAQ / verified FAQ:** question-answer pair from the clinically verified set (~40k).
- **Direct / verbatim answer:** FAQ answer returned word for word.
- **Context mode:** related FAQs passed to the model as reference.
- **Turn:** one user message and the assistant's reply. Has a client-chosen id.
- **Barge-in:** the user interrupting the assistant mid-reply.
- **Source:** `safety`, `faq` or `model`: where an answer sentence came from.
- **Echo LLM:** placeholder model for development.
- **UNVERIFIED:** written but not run against the real thing.

## 8. Log

| Date | Entry |
|---|---|
| 2026-10-03 | Backend designed and built from scratch; 81 tests passing with fakes. |
| 2026-10-03 | Protocol gap found while planning the voice phase (stale frames after interruption). Fixed with client-assigned turn ids; 83 tests passing. |
| 2026-10-03 | `product.md`, `CLAUDE.md`, `agent.md`, `memory.md`, `phases.md` written. No phase started. |
| 2026-10-03 | **Phase 0 completed**: Real machine verification on Windows (Python 3.13.9). Verified FastAPI routes, WebSocket handler, SSE streaming, sessions, safety guard, error cases. Added `backend/scripts/smoke_http.py` and `backend/tests/test_web_layer.py`. 85 tests passing. |

## 9. Environment & Package Versions (Phase 0)

- Python: 3.13.9 (64-bit Windows)
- Packages installed in `backend/.venv` via `pip install -e ".[dev]"`:
  - fastapi: 0.142.2
  - starlette: 1.7.0
  - uvicorn: 0.54.0
  - websockets: 17.1
  - pydantic: 2.13.5
  - pydantic-settings: 2.15.0
  - httpx: 0.28.1
  - httpcore: 1.0.9
  - numpy: 2.5.3
  - pyyaml: 6.0.3
  - pytest: 9.1.1
  - ruff: 0.16.10
  - mypy: 2.4.0
  - watchfiles: 1.3.0
  - anyio: 4.15.1

