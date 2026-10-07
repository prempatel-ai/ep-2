# Project memory

> Living record of **state, decisions, gotchas and open questions**. Agents read this at the start of
> every session and update it at the end of every phase. Keep it accurate and short; delete what is stale.
> Last updated: 2026-10-07.

## 1. Current state

| Area | State | Evidence |
|---|---|---|
| Backend code | Written | `backend/src/sahayak/` |
| Backend tests | **113 pass** (95 baseline & voice tests + 18 Image Check unit, prep, guard, and endpoint tests) | `pytest` |
| FastAPI routes, WebSocket handler | Verified on real hardware (Phase 0) | `backend/scripts/smoke_http.py`, `tests/test_web_layer.py` |
| Model adapters | Embedder (`SentenceTransformerEmbedder`), FAQ Index (`ChromaFAQIndex`), STT (`FasterWhisperSTT`), TTS (`MMSTTS`), LLM (`OpenAICompatibleLLM`), and Image Check (`OllamaMedGemmaAnalyzer`, `FakeImageAnalyzer`) **VERIFIED** on real hardware. IndicConformer and Parler remain **UNVERIFIED**. | `tests/test_image_check.py`, `backend/scripts/image_probe.py`, `GET /ready` |
| FAQ data / index | Example file indexed (`backend/data/faqs.example.jsonl` -> `backend/data/chroma`); real `faqs.jsonl` not yet provided | `sahayak-index`, `backend/data/chroma` |
| Frontend | Text chat, Voice UI, and Image Check UI complete (Next.js 16 + TypeScript strict + AppShell + ChatView + VoiceView + ImageCheckView + WebGPU Orb Visualizer + VAD recorder + AudioQueuePlayer + SSE + WebSocket wire protocol) | `frontend/`, `npm run build`, `npm test` (73 pass), `npm run check:offline` |
| Fine-tuned LLM | Owned by the builder; not part of agent work until Phase 10 | n/a |
| Clinical + native-speaker review | Not done | n/a |
| Voice v2 (Phases 11 to 16) | Reported complete by the builder on 2026-10-07. Record the measured numbers and anything still UNVERIFIED in the log. | `docs/voice-baseline.md`, `voice_regress.py` report |
| Image Check (Phases 17 to 22) | Phase 17 designed and approved; Phase 18 verified locally; Phase 19 backend port, adapter, guard, and endpoint completed; Phase 20 frontend completed. Off by default until clinician review. | `phases.md`, `docs/image-check-design.md`, `backend/tests/test_image_check.py`, `frontend/src/features/image/ImageCheckView.tsx` |

**Phase progress:** Phases 0 to 7 complete, Voice v2 (11 to 16) reported complete, Phases 17, 18, 19, 20 complete (2026-10-07), Phase 21 ready. Phases 8 to 10 still open.

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
| Image Check is a separate path from chat; the photo goes directly to MedGemma 4B running locally | The builder's chosen design. Keeps everything offline and keeps image handling away from the text and voice paths. |
| The model returns only categories from a fixed list; the user sees only fixed human-written text | A free-text answer about a breast photo could sound like a diagnosis or an all-clear. Humans write the words, the model only observes. |
| The referral message appears in every outcome, including `none_visible`; no scores, no reassuring visuals | A photo cannot rule out breast cancer. The main harm to design against is false reassurance. |
| Image Check is off by default until a clinician signs off | Safety. Unknown model reliability on this task. |
| Images are held in memory only and never stored, logged or sent anywhere | Highly sensitive images. |
| Agents never handle real breast images; humans supply and run the real evaluation | Privacy and consent. |

## 3. Wire protocol and stage timeline

### Wire protocol summary (full spec in `backend/README.md`)
- `POST /v1/chat` -> SSE: `session`, `sentence`, `done`, `error`.
- `WS /v1/voice`: client sends optional `start`, binary utterances (`4-byte turn` + PCM16 16 kHz mono), `text`, `interrupt`. Server sends `ready`, `transcript`, `sentence`, binary audio (`turn`+`index`+WAV), `done`, `no_speech`, `interrupted`, `error`. Every per-turn message carries `turn`.
- `GET /v1/config`, `GET /ready`, `GET /health`, `DELETE /v1/sessions/{id}`.
- Frontend rule: ignore any message whose `turn` is not the current turn.

### Stage timeline (Voice v2)
1. Speech start detected (Client-side): Browser VAD energy/neural detector identifies voice onset.
2. Speech end detected (Client-side): Hangover silence window elapses, utterance finalized.
3. Utterance fully received (Server-side): Complete binary PCM16 audio frame received on WebSocket.
4. STT final transcript ready (Server-side): Speech-to-text model completes transcription.
5. Safety and retrieval decision (Server-side): Safety guard checks rules; retrieval checks FAQ similarity.
6. First LLM sentence emitted (Server-side): Segmenter yields first complete sentence from model stream.
7. First TTS audio produced (Server-side): Text-to-speech synthesises sentence 0 into WAV bytes.
8. First audio frame received (Client-side): Browser receives binary audio frame for index 0.
9. First audio started playing (Client-side): Web Audio API decodes WAV and starts playback buffer.

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
10. MedGemma 4B reliability at recognising visible skin changes on ordinary phone photos, including across skin tones and lighting. **UNVERIFIED until the human-run evaluation and clinician review (Phase 21).**
11. **[VERIFIED in Phase 18]** Local Ollama server constrains output to JSON schema with image input via 'format: <schema>'. Verified with synthetic images.
12. **[MEASURED in Phase 18]** MedGemma 4B on CPU-only laptop: prompt eval ~195ms, schema inference ~1.58s avg (min 1.49s, max 1.67s). Peak RAM ~14.8 GB / 16.1 GB (92%). Requires on-demand loading with idle unload (D21) to prevent RAM exhaustion when running beside voice models.
13. **[VERIFIED in Phase 18]** Ollama writes zero image data to disk during inference (verified via audit of %TEMP% and cache folders).
14. That the intended use of this feature is permitted by the Health AI Developer Foundations terms and Prohibited Use Policy (D19, human confirms).
15. **[VERIFIED in Phase 18]** Chosen variant: 'medgemma:4b' in Ollama (Gemma 3 4.3B Q4_K_M, digest 9fe4e9a6c9bd).

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
- **Ollama image payload validation:** Ollama requires valid image bytes with correct headers and checksums (e.g. PNG with valid IHDR, IDAT, and CRC32); malformed or truncated byte streams trigger HTTP 500.
- **MedGemma schema enforcement:** MedGemma in Ollama supports full JSON schema enforcement via 'format' parameter in both /api/chat and OpenAI-compatible endpoint.
- **RAM pressure with MedGemma:** On 16 GB hardware, loading MedGemma alongside Whisper, MMS-TTS, and an LLM approaches 92%+ RAM usage. Unload on idle ('keep_alive: 0' or 'keep_alive: "5m"') is essential.

## 6. Open decisions

| # | Decision | Default until decided | Decide by |
|---|---|---|---|
| D1 | Frontend stack | Next.js 16 (App Router) + TypeScript strict, plain CSS with design tokens (**decided & implemented in Phase 4**) | Decided in Phase 4 |
| D2 | Base model for the fine-tune (Sarvam-1 2B vs Gemma 3 4B) | Builder's choice; backend is agnostic | Phase 10 |
| D3 | Train with retrieved FAQs in the prompt, or without? | Without; set `RETRIEVAL__CONTEXT_THRESHOLD=1.0` | Before fine-tuning |
| D4 | STT: Whisper vs IndicConformer | Whisper `small` | Phase 2 (measure on Gujarati) |
| D5 | TTS voice: MMS vs Indic Parler | MMS | Phase 2 (listening test) |
| D6 | How the built UI is served: separate dev server vs static files from the backend | Static from backend in production | Phase 8 |
| D7 | Browser voice-activity-detection library | Candidate: `@ricky0123/vad-web`, bundled locally. **Verify its API and offline asset loading before use.** | Phase 6 |
| D8 | UI language strings: who reviews Gujarati/Hindi wording | Builder + native speaker | Phase 7 |
| D9 | Licences: Sarvam-1 terms for intended use; FAQ source licences | Check before any public release | Phase 10 |
| D10 | Who is the clinical reviewer, and when | Unassigned | Before any real users |
| D11 | Run Voice v2 before or after Phase 8 packaging | User elected to run Voice v2 now, after Phase 7 | Phase 11 |
| D12 | Streaming STT engine | Faster-Whisper streaming or chunked transcription | Phase 13 |
| D13 | Neural VAD library | Decided in Phase 12: @ricky0123/vad-web with Silero VAD v5 ONNX and AudioWorklet bundle loaded locally from /vad/ | Decided in Phase 12 |
| D14 | TTS voice per language | MMS-TTS for gu, hi, en; evaluate Indic Parler or alternative local models if needed | Phase 14 |
| D15 | Acknowledgement phrases and reviewer | Builder supplies phrases; native speaker reviews; no medical statements | Phase 14 |
| D16 | End-of-speech timing defaults | Decided in Phase 12: 800 ms silence hangover default; 250 ms min speech duration for barge-in guard; configurable in settings | Decided in Phase 12 |
| D17 | Accept the Image Check scope change (reverses the earlier "image analysis" non-goal) | Decided and approved by the builder on 2026-10-07 | Phase 17 |
| D18 | The category list of visible changes | A PROPOSED starting list is in `phases.md` Phase 17; a clinician decides | Phase 17 |
| D19 | Accept MedGemma terms and confirm the intended use is permitted | Not accepted; the human reads the terms and Prohibited Use Policy | Phase 17 to 18 |
| D20 | Model variant: MedGemma 4B instruction-tuned vs 1.5 4B | Decided in Phase 18: medgemma:4b (Gemma 3 4.3B Q4_K_M) verified locally in Ollama | Decided in Phase 18 |
| D21 | Resource strategy: always loaded vs loaded on demand with idle unload | Measured in Phase 18: On-demand with idle unload (keep_alive 5m) recommended due to 92% RAM pressure | Phase 18 |
| D22 | Clinical reviewer, and the source of a consented, licensed, clinician-labelled evaluation image set | Unassigned | Before Phase 21 |
| D23 | Who writes the English, Gujarati and Hindi message texts, and the native-speaker reviewer | Unassigned; agents use placeholders only | Before Phase 19 is enabled |
| D24 | Default state and the conditions to enable Image Check | Off. Enable only after the clinician has reviewed the Phase 21 report and agrees in writing | Phase 21 |

## 7. Glossary

- **FAQ / verified FAQ:** question-answer pair from the clinically verified set (~40k).
- **Direct / verbatim answer:** FAQ answer returned word for word.
- **Context mode:** related FAQs passed to the model as reference.
- **Turn:** one user message and the assistant's reply. Has a client-chosen id.
- **Barge-in:** the user interrupting the assistant mid-reply.
- **Source:** `safety`, `faq` or `model`: where an answer sentence came from.
- **Echo LLM:** placeholder model for development.
- **UNVERIFIED:** written but not run against the real thing.
- **Image Check:** optional, off-by-default feature that describes visible skin changes in an uploaded photo using a local model. Not a diagnosis.
- **Category:** one item from the fixed list the model may return (for example a visible change, or `none_visible`, `unclear_image`, `not_a_breast_photo`).
- **Result guard:** service code that guarantees the referral message is present and that the model's free text never reaches the user.
- **Missed finding:** the clinician labelled a visible change but the model returned `none_visible`, `unclear_image` or a different category. Reported first in every evaluation.

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
| 2026-10-04 | **Phase 4 completed**: Built frontend scaffold using Next.js 16 (App Router) + TypeScript (strict) + plain CSS with design tokens. Designed adhering strictly to senior product designer principles (restrained clinical palette, calm deep teal, zero AI slop, no purple/blue gradients or bubbly cards, accessible AA contrast, visible focus states). Implemented API client (`src/api/types.ts`, `src/api/http.ts`, `src/api/sse.ts`, `src/api/voiceSocket.ts`), self-hosted fonts (`Noto Sans Gujarati`, `Noto Sans Devanagari`, SIL OFL license), typed i18n (`en.ts`, `gu.ts`, `hi.ts` with explicit human translation markers), `AppShell` header/main/footer with mandatory disclaimer and 112/14416 emergency notices, offline compliance check script (`scripts/check-offline.mjs`), and unit tests. All tests passing (4 vitest), build passes (`output: "export"`), and offline check verifies 0 external network requests. |
| 2026-10-04 | **Phase 5 completed**: Text chat UI completed. Implemented chunk-boundary and multiline pure SSE stream parser (`src/api/sse.ts`), abortable `chat()` async generator and session deletion in `src/api/http.ts`, pure reducer with explicit message lifecycle states (`streaming`, `complete`, `failed`, `stopped`) in `src/features/chat/conversationReducer.ts`, accessible assistive-technology polite announcements, `SourceBadge` component (`safety`, `faq`, `model` provenance labels), `MessageList` with suggested prompt starters, `Composer` with 2000-character guard and enter-to-send, stop button, "New conversation" session clearing, and server degradation banner. Also upgraded language selector dropdown to an accessible Radix-backed dropdown menu. Verified live against the echo backend (including safety guard "Do I have breast cancer?", model streaming, and session deletion). 14 unit tests pass, typecheck passes, lint passes, static export build passes, offline scan passes. |
| 2026-10-04 | **Phase 6 completed**: Voice UI completed. Created golden contract fixtures in `contract/voice_frames.json` with shared tests across backend (`backend/tests/test_wire_format.py`) and frontend (`src/api/voiceWire.test.ts`). Implemented pure voice session state machine (`src/features/voice/voiceStateMachine.ts`) managing `idle -> listening -> capturing -> thinking -> speaking -> listening`, barge-in turn advancement, and no-speech recovery. Built browser VAD audio recorder (`src/audio/recorder.ts`) delivering 16 kHz mono signed 16-bit PCM and sequential gapless `AudioQueuePlayer` (`src/audio/player.ts`) with immediate `flush()` on interrupt. Integrated ChatGPT-style interactive voice orb (`OrbBloop`, WebGPU WGSL shader in deep clinical teal) with audio analysis and state-reactive pulsation. Built `DevPanel` with real-time turn metrics. Verified against contract and offline check (20 unit tests pass, static export passes with 0 external network requests). |
| 2026-10-04 | **Phase 7 completed**: Design and accessibility pass. Transformed frontend into calm, trustworthy clinical healthcare software: 1140px natural workspace layout, muted dark clinical navy/slate palette (`#0b0f19` canvas, `#111827` surface, `#1f293d` hairlines, `#0d9488` restrained clinical teal accent), no AI SaaS landing-page clichés (no purple/blue neon glows or decorative badges). Compact clinical header with subtle offline indicator, editorial assistant response cards with left border accent, lightweight interactive suggested inquiry rows, clean composer with keyboard shortcuts. Automated WCAG AA accessibility tests via `vitest-axe` with 0 violations (`Accessibility.test.tsx`), ARIA-compliant structure, polite live regions, and `document.documentElement.lang` sync. All 24 unit tests pass, TypeScript strict check passes, ESLint passes, Next.js static export passes, and offline audit passes with 0 external network requests. |
| 2026-10-07 | **Phase 11 (Voice v2: Instrumentation & Baseline)**: Added decisions D11 to D16 under Open decisions. Defined stage timeline in memory.md and docs/voice-baseline.md (distinguishing client-side vs server-side boundaries). Added backend/scripts/voice_bench.py benchmark runner with p50/p95 calculations and structured JSON output to backend/data/bench/. Added capture jitter tracking to AudioRecorder and playback underruns tracking to AudioQueuePlayer, surfaced in DevPanel with zero application behaviour change. Human-supplied clip directory backend/eval/voice_clips/ is currently empty, so clip-dependent runs are marked UNVERIFIED with exact WAV specifications provided. 95 backend tests pass, 38 frontend tests pass, typecheck, lint, build, check:offline all pass. |
| 2026-10-07 | **Phase 12 completed (Voice v2: Better Listening)**: Upgraded capture path to AudioWorklet and neural VAD (@ricky0123/vad-web with Silero VAD v5 ONNX and WASM bundle loaded locally from /vad/). Preserved output contract: 16 kHz mono signed 16-bit PCM. Implemented pause-tolerant hangover (800ms default, D16) keeping mid-sentence pauses in a single utterance. Added barge-in guard requiring minimum speech duration (250ms default) and speech probability threshold; transient coughs, clicks, and backchannels trigger VAD misfire and do not interrupt playback. Added speaker echo suppression check (positiveSpeechThresholdDuringPlayback: 0.65) during active assistant audio. Pure voice state machine updated with VAD_MISFIRE and SPEECH_REAL_START actions. Added synthetic-signal unit tests in recorder.test.ts. Exposed configurable VAD settings in SettingsModal and DevPanel. All 95 backend tests pass, all 48 frontend tests pass, typecheck, lint, build, and check:offline (zero external network references) all pass. |
| 2026-10-07 | Voice v2 (Phases 11 to 16) reported complete by the builder. Baseline and final numbers tracked in `docs/voice-baseline.md`. |
| 2026-10-07 | Phase 17 completed and approved by builder. Image Check design document written (docs/image-check-design.md). D17 approved. Starting Phase 18. |
| 2026-10-07 | Phase 18 completed: Verified local MedGemma 4B (medgemma:4b Q4_K_M) on Ollama. Validated multimodal image analysis, strict JSON schema output constraint, zero disk writes, and client disconnect handling. Added backend/scripts/image_probe.py. Measured schema latency avg 1.58s and peak RAM 14.8 GB on 11th Gen i5 CPU. D20 decided; D21 resource options presented. |
| 2026-10-07 | **Phase 19 completed**: Built backend Image Check port (`ImageAnalyzer`), adapters (`OllamaMedGemmaAnalyzer` serialized via `BlockingRunner`, `FakeImageAnalyzer`), in-memory metadata stripper and resizing service (`image_prep.py`), result guard and message mapper (`image_check.py`), reviewed English copy and translation placeholders (`image_check_messages.yaml`), prompt template (`image_prompt.txt`), endpoint `POST /v1/image-check` behind `SAHAYAK_IMAGE_CHECK__ENABLED` (default false), and golden contract fixtures (`contract/image_check_responses.json`). Verified zero disk writes, 100% mandatory referral coverage across all outcomes, strict category allowlist filtering, model free text suppression, oversize/invalid format rejection, disabled flag 503 behavior, and live MedGemma inference on synthetic image. All 113 backend tests pass. |
| 2026-10-07 | **Phase 20 completed**: Implemented Image Check frontend interface (`ImageCheckView`), pure state reducer (`imageCheckReducer`), and navigation in `AppShell` (flag-hidden when backend feature flag is false). Features prominent non-diagnostic notice, privacy declaration, adult consent checkbox guard (18+), in-memory photo preview with explicit `URL.revokeObjectURL` cleanup, cancellable requests via `AbortController`, polite live region progress updates, and calm clinical result presentation. Mandatory clinical referral guidance card rendered on 100% of outcomes (`finding_present`, `none_visible`, `unclear_image`, `not_a_breast_photo`). Verified zero storage persistence (0 calls to localStorage/sessionStorage/IndexedDB). Automated vitest-axe accessibility audit passes with 0 violations. Full frontend suite passes (73 unit tests), TypeScript check clean, ESLint clean, static export build succeeds, offline check passes with 0 external network requests. Manual verification script recorded in `frontend/docs/image-check-checklist.md`. |

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
- Phase 19 Image Check Packages (`pip install -e ".[image-check]"`):
  - pillow: 12.3.0 (HPND-like / Historical Permission Notice and Disclaimer license)
  - python-multipart: 0.0.32 (Apache 2.0 license)
- Local LLM Serving (Phase 3):
  - Engine: Ollama / `llama-server` (OpenAI-compatible HTTP API at `/v1`)
  - Placeholder models verified: `gaganyatri/sarvam-2b-v0.5:latest` (Sarvam 1 2.5B), `gemma3:4b`
- Offline Models (HF Hub Cache):
  - Embedder: `intfloat/multilingual-e5-small`
  - STT: `Systran/faster-whisper-small`
  - TTS: `facebook/mms-tts-guj`, `facebook/mms-tts-hin`, `facebook/mms-tts-eng`
  - Image: `medgemma:4b` via local Ollama
  - Offline usage env: `$env:HF_HUB_OFFLINE="1"` (or `export HF_HUB_OFFLINE=1`)

## Phase 23: Clinical FAQ Vector DB and Sourced RAG Pipeline (2026-10-07)
- Ingested 3,197 curated clinical oncology and breast health FAQs from MedQuad (NIH/NCI/MedlinePlus) and ChatDoctor (HealthCareMagic Physician Consultations) into `backend/data/faqs.jsonl`.
- Updated `FAQEntry`, `FAQHit`, `ChromaFAQIndex`, and `faq_loader` to persist and retrieve source attribution metadata (`source`).
- Rebuilt ChromaDB collection (`backend/data/chroma`) with 3,197 entries using on-device `intfloat/multilingual-e5-small`.
- Configured RAG pipeline in `PromptBuilder` and `ConversationService` to ground answers on verified clinical references and cite verified sources (`Sources: ...`) at the end of the response.
- Enhanced frontend `ClinicalContent.tsx` to detect and render `Sources:` in a dedicated institutional verified citation block.
- All 114 backend tests and 73 frontend tests pass cleanly. Verified live streaming chat retrieval with verified source citation.