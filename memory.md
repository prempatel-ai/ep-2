# Project memory

> Living record of **state, decisions, gotchas and open questions**. Agents read this at the start of
> every session and update it at the end of every phase. Keep it accurate and short; delete what is stale.
> Last updated: 2026-10-03.

## 1. Current state

| Area | State | Evidence |
|---|---|---|
| Backend code | Written | `backend/src/sahayak/` |
| Backend tests | **92 pass** (81 baseline unit tests + 4 web layer tests + 7 model-free Chroma retrieval tests) | `pytest` |
| FastAPI routes, WebSocket handler | Verified on real hardware (Phase 0) | `backend/scripts/smoke_http.py`, `tests/test_web_layer.py` |
| Model adapters | Embedder (`SentenceTransformerEmbedder`), FAQ Index (`ChromaFAQIndex`), STT (`FasterWhisperSTT`), TTS (`MMSTTS`), and LLM (`OpenAICompatibleLLM`) **VERIFIED** on real hardware (Phases 1, 2 & 3). IndicConformer and Parler remain **UNVERIFIED**. | `tests/test_retrieval_fake_embedder.py`, `scripts/tts_listen.py`, `scripts/ws_smoke.py`, Ollama Sarvam 1 / Gemma 3, `GET /ready` |
| FAQ data / index | Example file indexed (`backend/data/faqs.example.jsonl` -> `backend/data/chroma`); real `faqs.jsonl` not yet provided | `sahayak-index`, `backend/data/chroma` |
| Frontend | Not started | n/a |
| Fine-tuned LLM | Owned by the builder; not part of agent work until Phase 10 | n/a |
| Clinical + native-speaker review | Not done | n/a |

**Phase progress:** Phase 0, Phase 1, Phase 2, and Phase 3 complete (see `phases.md`).

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

1. **[VERIFIED in Phase 0]** Server starts; `/ready`, `/v1/config`, `/v1/chat`, `/v1/voice` behave as documented with echo model & disabled services.
2. **[VERIFIED in Phase 2]** `faster-whisper` (`FasterWhisperSTT` small, int8 CPU): model load (2.0s), transcription, language resolution verified via WebSocket.
3. `IndicConformer` call: `model(waveform, lang, decoder)` and `trust_remote_code` loading (`adapters/stt_indic_conformer.py`).
4. **[VERIFIED in Phase 2]** `MMS-TTS` (VITS, `MMSTTS`): load (29.6s for gu, hi, en) and output sample rate (16000 Hz, RTF 0.65-0.70 on CPU) verified via `scripts/tts_listen.py` and WebSocket streaming.
5. `Indic Parler-TTS` generate call (`adapters/tts_parler.py`). Parler-TTS dependency resolution attempts to downgrade core libraries (transformers 4.46 vs 5.x) so it was deferred in favour of MMS.
6. **[VERIFIED in Phase 1]** ChromaDB `PersistentClient`, `query` result shape, cosine distance -> score (`adapters/faq_chroma.py`), and `SentenceTransformerEmbedder` (`adapters/embedder_st.py`). Model `intfloat/multilingual-e5-small` verified from cold start offline (`HF_HUB_OFFLINE=1`).
7. Whether llama.cpp supports the chosen base model's architecture for GGUF conversion (Phase 10).
8. **[MEASURED in Phase 2]** Latency targets in `product.md` §8 (target: first audio ≤ 4.0s on CPU-only laptop):
   - **Hardware:** 11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz (6 cores, 12 logical processors), 16 GB RAM, integrated Intel UHD Graphics, CPU-only execution.
   - **Model load times:** Whisper `small` (int8, CPU) = 2.0s; MMS-TTS (all 3 languages: gu, hi, en) = 29.6s (~9.8s/lang).
   - **Measured voice turn latencies (echo LLM, CPU):**
     - Short utterance (1.87s): `stt_ms` = 4146ms, `first_sentence_ms` = 4433ms, `first_audio_ms` = 5532ms, `total_ms` = 7756ms
     - Medium utterance (4.37s): `stt_ms` = 4186ms, `first_sentence_ms` = 4471ms, `first_audio_ms` = 5633ms, `total_ms` = 8878ms
     - Long utterance (6.59s): `stt_ms` = 4315ms, `first_sentence_ms` = 4590ms, `first_audio_ms` = 5515ms, `total_ms` = 8780ms
   - **Target assessment:** The target (first audio ≤ 4.0s on CPU) is **NOT MET** on CPU alone (measured first audio ~5.5s, with Whisper transcription alone accounting for ~4.1s). GPU acceleration or smaller models (e.g. whisper `base` or `tiny`) will be needed to hit ≤ 4.0s.
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
- **Windows Chroma TemporaryDirectory cleanup:** Chroma's background `BlockingRunner` thread may hold open SQLite / HNSW file locks when a temporary directory exits. Use `ignore_cleanup_errors=True` in temp dirs during unit tests.
- **Windows console output encoding:** On Windows, `sys.stdout` and `sys.stderr` default to `cp1252` encoding. CLI scripts printing Indic scripts (Gujarati/Hindi) must reconfigure them using `isinstance(sys.stdout, io.TextIOWrapper) and sys.stdout.reconfigure(encoding="utf-8")`.

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
| 2026-10-04 | **Phase 1 completed**: Installed `[rag]` dependencies (`chromadb`, `sentence-transformers`, `torch`, etc.). Pre-downloaded `intfloat/multilingual-e5-small`. Verified offline loading via `HF_HUB_OFFLINE=1`. Ran `sahayak-index` on `faqs.example.jsonl` (usable: 2, duplicates: 0) and proved idempotency across multiple runs. Real `faqs.jsonl` not yet present (`faq_conflicts.txt` created empty). Added `backend/scripts/check_retrieval.py` and `backend/scripts/tune_thresholds.py`. Added `backend/eval/retrieval_probes.example.jsonl`. Added model-free integration tests in `backend/tests/test_retrieval_fake_embedder.py` (7 tests). Total tests passing: 92. |
| 2026-10-04 | **Phase 2 completed**: Installed `[stt-whisper]` and `[tts-mms]` (`faster-whisper 1.2.1`, `ctranslate2 4.8.2`, `av 19.0.1`). Pre-downloaded `Systran/faster-whisper-small` and Meta MMS TTS (`facebook/mms-tts-guj`, `facebook/mms-tts-hin`, `facebook/mms-tts-eng`). Added `backend/scripts/tts_listen.py` (generates Gujarati, Hindi, English WAV samples). Added `backend/scripts/ws_smoke.py` (WebSocket smoke test with audio and text turns, saves audio frames, tests interruption). Measured model load times and end-to-end voice turn latencies across 3 utterance lengths on 11th Gen Intel i5-11400H CPU. Recorded that CPU-only first audio target (≤ 4.0s) was not met (~5.5s measured). Verified server interruption handling and health recovery. All 92 tests pass. |
| 2026-10-04 | **Phase 3 completed**: Verified model-serving contract with local OpenAI-compatible endpoint (`http://127.0.0.1:11434/v1`, Ollama) running placeholder models `gaganyatri/sarvam-2b-v0.5:latest` (Sarvam 1 2.5B) and `gemma3:4b`. Verified incremental SSE streaming on `POST /v1/chat` (first sentence arrived at 5.66s, last at 17.99s). Verified `GET /ready` returns 503 and chat returns `llm_unavailable` error event when model server is down while process stays healthy. Verified generation cancellation when stream is disconnected. Added `backend/scripts/dump_prompt.py`, `backend/scripts/run_llm_server.sh`, `backend/scripts/run_llm_server.ps1`, and `docs/finetune-handoff.md`. All 92 tests pass. |

## 9. Environment & Package Versions

- Python: 3.13.9 (64-bit Windows)
- Baseline & Dev Packages (`backend/.venv` via `pip install -e ".[dev]"`):
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
- Phase 1 RAG Packages (`pip install -e ".[rag]"`):
  - chromadb: 1.5.9
  - sentence-transformers: 6.1.0
  - torch: 2.14.1
  - transformers: 5.18.0
  - scikit-learn: 1.9.1
  - onnxruntime: 1.30.0
- Phase 2 Speech Packages (`pip install -e ".[stt-whisper,tts-mms]"`):
  - faster-whisper: 1.2.1
  - ctranslate2: 4.8.2
  - av: 19.0.1
- Local LLM Serving (Phase 3):
  - Engine: Ollama / `llama-server` (OpenAI-compatible HTTP API at `/v1`)
  - Placeholder models verified: `gaganyatri/sarvam-2b-v0.5:latest` (Sarvam 1 2.5B), `gemma3:4b`
- Offline Models (HF Hub Cache):
  - Embedder: `intfloat/multilingual-e5-small`
  - STT: `Systran/faster-whisper-small`
  - TTS: `facebook/mms-tts-guj`, `facebook/mms-tts-hin`, `facebook/mms-tts-eng`
  - Offline usage env: `$env:HF_HUB_OFFLINE="1"` (or `export HF_HUB_OFFLINE=1`)

