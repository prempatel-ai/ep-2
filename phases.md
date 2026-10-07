# Phases

The build plan for an autonomous agent. **One phase at a time, in order.** Each phase produces a working
vertical slice that can be checked, not a pile of half-finished parts.

Read `agent.md` first. Its rules apply to every phase: stay in scope, report only what you ran, mark
anything unrun **UNVERIFIED**, never touch the do-not-touch list, and finish with the handoff block.

## Progress

- [x] Phase 0: Verify the backend on a real machine (2026-10-03)
- [x] Phase 1: FAQ data and retrieval (2026-10-04)
- [x] Phase 2: Speech on real hardware (2026-10-04)
- [x] Phase 3: Model-serving contract (placeholder model) (2026-10-04)
- [x] Phase 4: Frontend scaffold (2026-10-04)
- [x] Phase 5: Text chat UI (2026-10-04)
- [x] Phase 6: Voice UI (2026-10-04)
- [x] Phase 7: Design and accessibility pass (2026-10-04)
- [ ] Phase 8: Packaging and one-command run
- [ ] Phase 9: Evaluation and safety-review tooling
- [ ] Phase 10: Plug in the fine-tuned model
- [x] Phase 11: Voice v2, instrumentation and baseline (reported complete by the builder, 2026-10-07; evidence lives in `memory.md`)
- [x] Phase 12: Voice v2, better listening (reported complete by the builder, 2026-10-07; evidence lives in `memory.md`)
- [x] Phase 13: Voice v2, streaming input and streaming STT (reported complete by the builder, 2026-10-07; evidence lives in `memory.md`)
- [x] Phase 14: Voice v2, natural speaking (reported complete by the builder, 2026-10-07; evidence lives in `memory.md`)
- [x] Phase 15: Voice v2, conversation state (reported complete by the builder, 2026-10-07; evidence lives in `memory.md`)
- [x] Phase 16: Voice v2, regression harness and startup experience (reported complete by the builder, 2026-10-07; evidence lives in `memory.md`)
- [x] Phase 17: Image Check, scope, safety design and proposals (documents only) (2026-10-07)
- [x] Phase 18: Image Check, run MedGemma 4B locally and verify it (2026-10-07)
- [x] Phase 19: Image Check, backend port, adapter, guard and endpoint (2026-10-07)
- [ ] Phase 20: Image Check, frontend
- [ ] Phase 21: Image Check, evaluation and clinical safety review
- [ ] Phase 22: Image Check, integration, packaging and limitations

**Skeleton complete = Phases 0 to 8.** Phases 9 and 10 turn it into something measured and real.
**Voice v2 = Phases 11 to 16.** An optional track that made the voice conversation feel more human. The builder
reports it complete; the agent should treat `memory.md` as the record of what was measured and what remains UNVERIFIED.
**Image Check = Phases 17 to 22.** An optional, safety-critical track: upload a photo and get a description of visible
skin changes from MedGemma 4B running locally, always with a referral to a clinician. Phase 17 is documents only and
ends with a human approval gate. The feature stays **off by default** until a clinician signs off (D24). It does not
depend on Phases 8 to 10, but Phase 8 packaging should be updated for it in Phase 22.

## How to run a phase

1. Re-read `product.md`, `memory.md`, this file's section for the phase, and `CLAUDE.md`.
2. Create branch `phase-<n>-<slug>`.
3. Do the tasks. Build the smallest thing that meets the acceptance checks.
4. Run **every** acceptance check. Record command and result.
5. Update `memory.md` (state, decisions, gotchas, unverified items, log) and tick the box above with the date.
6. Output the handoff block from `agent.md` §9 and **stop**. Do not begin the next phase until told to.

## Rules that hold in every phase

- Nothing leaves the machine at runtime. No CDN assets, no analytics, no remote fonts.
- Never log or persist user text, transcripts, answers, audio, or images.
- Never author or edit medical content: FAQ answers, safety patterns or replies, helpline numbers, medical wording
  in prompts or UI. Build tooling that *uses* them; leave their content to humans.
- Example data you create must be clearly marked `EXAMPLE` and must not look like real medical guidance.
- If the code and these docs disagree, stop and report; do not pick silently.

---

## Phase 0: Verify the backend on a real machine

**Why:** the backend was written and unit-tested with fakes, but its web layer and model adapters have never
been run. Everything later depends on them. Find out what is really broken before building on it.

**Needs:** Python 3.11+, internet for the one-time install. No FAQ data, no models.

**Tasks**
1. Create a venv in `backend/`, install `pip install -e ".[dev]"`. Record exact Python and package versions in `memory.md`.
2. Run the test suite. Expected: 83 tests pass.
3. Start the server with no heavy dependencies:
   `SAHAYAK_LLM__BACKEND=echo SAHAYAK_RETRIEVAL__BACKEND=disabled SAHAYAK_STT__BACKEND=disabled SAHAYAK_TTS__BACKEND=disabled python -m sahayak`
4. Exercise every HTTP endpoint with `curl` (see checks). Fix real bugs found, each with a test where the test can run without models.
5. Add `backend/scripts/smoke_http.py` (stdlib only: `urllib`/`http.client`): runs the checks below against a running server and prints PASS/FAIL per check.
6. Run `ruff check` and `mypy` if installed; fix what is reasonable in files you touch; record what remains.

**Acceptance checks**
- `GET /health` → 200 `{"status":"ok",...}`
- `GET /ready` → 200 with `ready: true` (retrieval disabled, echo model)
- `GET /v1/config` → lists `gu`, `hi`, `en`, `voice: false`
- `POST /v1/chat` with `{"text":"hello"}` streams `session`, one or more `sentence` (source `model`), then `done`
- `POST /v1/chat` with `{"text":"Do I have breast cancer?","language":"en"}` returns only `source: "safety"` sentences, and the echo model is not used
- `POST /v1/chat` with `{"text":"   "}` → 422
- `DELETE /v1/sessions/<id from chat>` → 204; again → 404
- WebSocket `/v1/voice` connects and receives `ready` with `voice: false`; sending `{"type":"text","turn":1,"text":"hi","speak":false}` yields `sentence` messages with `"turn":1`, then `done`; sending `speak:true` yields an `error` with code `voice_unavailable` and `"turn":1`
- `smoke_http.py` prints all PASS

**Out of scope:** FAQ data, speech models, frontend, any refactor.

---

## Phase 1: FAQ data and retrieval

**Why:** 40k verified FAQs are the product's backbone. Prove they load, index and retrieve sensibly, and get the
tooling to tune the verbatim-answer threshold.

**Needs:** Phase 0 done. The builder places the real file at `backend/data/faqs.jsonl` (never committed). Until then use `faqs.example.jsonl`.

**Tasks**
1. Install extras: `pip install -e ".[rag]"`. Pre-download the embedding model and note how to make it work offline (`HF_HUB_OFFLINE=1`); record in `memory.md`.
2. Run `sahayak-index` on the example file, then on the real file when available. Fix real bugs.
3. Review the loader report on the real file and **list, do not resolve**, every conflict (same question, different answer) in `backend/data/faq_conflicts.txt` (line numbers only) for the human.
4. Add `backend/scripts/check_retrieval.py`: given a text file of queries, prints top-k hits with scores. Output is for developer eyes only.
5. Add `backend/scripts/tune_thresholds.py`: reads a probe file (`{"query": ..., "expected_question": ...}` per line), runs retrieval, and prints (a) the score distribution of correct vs incorrect top hits, (b) for thresholds 0.80 to 0.98 in steps of 0.02: how many probes would be answered verbatim and what fraction of those are correct. Ship `backend/eval/retrieval_probes.example.jsonl` with 3 **EXAMPLE** probes.
6. Add a test that builds an index from the example file using a fake embedder (deterministic vectors) and checks search order. Keep it model-free.

**Acceptance checks**
- `sahayak-index` completes on the example file and prints counts; `GET /ready` reports `faq_entries` equal to the usable count.
- Rerunning `sahayak-index` leaves the entry count unchanged (idempotent).
- `check_retrieval.py` returns the matching example FAQ first for a paraphrase.
- `tune_thresholds.py` runs on the example probes and prints the table.
- Index and loader work from a cold start with `HF_HUB_OFFLINE=1`.
- All tests pass.

**Out of scope:** writing probe questions or paraphrases for real medical content (the human supplies these); editing FAQ text; choosing the final threshold (the human decides from the table).

---

## Phase 2: Speech on real hardware

**Why:** speech quality and latency decide whether the product feels human. Measure on the actual laptop.

**Needs:** Phase 0 done (Phase 1 helpful). A microphone is not required; use WAV files.

**Tasks**
1. Install `stt-whisper` and `tts-mms` extras. Start the server with `SAHAYAK_LLM__BACKEND=echo`, retrieval disabled, speech enabled. Fix real adapter bugs.
2. Add `backend/scripts/ws_smoke.py`: connects to `/v1/voice`, sends a 16 kHz mono WAV as an utterance (chosen turn id), prints each message, saves audio frames as WAV files, prints the `done` metrics. Add the WebSocket client library as a **dev** dependency only, after confirming its API.
3. Add `backend/scripts/tts_listen.py`: for each configured TTS backend and each language, synthesises the existing fixed strings in `services/messages.py` (do not write new Gujarati/Hindi text) to WAV files in `backend/data/tts_samples/` so the human can listen and compare.
4. If `stt-indic` is installable, verify the IndicConformer adapter the same way; if its call differs from the code, fix the adapter and note the correct usage in `memory.md`.
5. If `tts-parler` is installable, verify the Parler adapter and add its samples.
6. Measure and record, on this machine: model load times, `stt_ms`, `first_sentence_ms`, `first_audio_ms`, `total_ms` for 3 utterance lengths. Record hardware (CPU, RAM, GPU) beside the numbers.
7. Test interruption server-side: start a voice turn, send `interrupt`, confirm `interrupted`, confirm no further messages for that turn arrive, then confirm a new turn works.

**Acceptance checks**
- `ws_smoke.py` against a real WAV returns `transcript`, `sentence`, binary audio, `done`; saved WAVs play.
- Numbers recorded in `memory.md` with hardware. Compare to the targets in `product.md` §8 and say whether they are met. Do not round in our favour.
- Interrupt test passes and leaves the server healthy (`GET /ready` still 200).
- Sample WAVs exist for each backend × language that loaded.
- Tests pass; no regression.

**Out of scope:** choosing STT/TTS winners (the human listens and decides D4 and D5), model fine-tuning, frontend.

---

## Phase 3: Model-serving contract (placeholder model)

**Why:** prove the full path with a real local model server before the fine-tuned model exists, so Phase 10 is only a file swap.

**Needs:** any small chat GGUF supplied by the human (not the fine-tuned one), and a built `llama-server`.

**Tasks**
1. Write `backend/scripts/run_llm_server.sh` (and a `.ps1` if the human uses Windows) that starts `llama-server` with documented flags. Verify the flags against the installed `llama-server --help`; do not rely on memory.
2. Run the backend against it (`SAHAYAK_LLM__BACKEND=openai_compatible`). Fix adapter bugs.
3. Add `backend/scripts/dump_prompt.py`: prints the exact message list `PromptBuilder` produces for a sample question in each language, with and without a reference block.
4. Write `docs/finetune-handoff.md` for the human: the exact prompt layout the model will receive (taken from `dump_prompt.py` output), the chat-template caveat (the template baked into the GGUF/server must match training), decision D3 (train with or without reference block), the sampling settings used, and the GGUF conversion steps as commands **marked UNVERIFIED** until run.
5. Verify cancellation reaches the model: start a long generation, close the connection, and show from `llama-server`'s log or CPU use that generation stops.

**Acceptance checks**
- `POST /v1/chat` through the real local model returns `source: "model"` sentences, streamed incrementally (first sentence arrives before the last is generated; show timestamps).
- `/ready` reports `llm: true` with the server up and `llm: false`, HTTP 503 from `/ready`, with it down; a chat request with it down returns an `llm_unavailable` error event and the server stays up.
- Cancellation check shown.
- `dump_prompt.py` output saved in `docs/finetune-handoff.md`.
- Tests pass.

**Out of scope:** fine-tuning, quantisation experiments, changing the prompt layout.

---

## Phase 4: Frontend scaffold

**Why:** a solid, strict, offline-safe base before any feature work. Confirm decision **D1** with the human first; the default is React + Vite + TypeScript (strict).

**Needs:** Node LTS. Phases 0 to 3 not strictly required, but the echo backend (Phase 0) is.

**Tasks**
1. Create `frontend/` with the chosen stack. TypeScript strict. ESLint, Prettier, Vitest + Testing Library. Pin the dependency versions you install in `package.json`; verify each exists before adding it.
2. Structure:
   ```
   frontend/src/
     api/        types.ts  http.ts  sse.ts  voiceSocket.ts   (empty stubs allowed only for 5 and 6)
     audio/      (Phase 6)
     features/   chat/  voice/  settings/
     components/ shared building blocks
     i18n/       en.ts  gu.ts  hi.ts  index.ts
     styles/     tokens.css  fonts.css  base.css
   frontend/public/fonts/   self-hosted fonts (see below)
   ```
3. `api/types.ts`: types mirroring the wire protocol in `backend/README.md` exactly (messages, events, `source`, `metrics`, `turn`). Type-only; no logic.
4. Design tokens in `tokens.css` (colour, type scale, spacing, radius, motion) as CSS variables; light and dark values. Keep the palette restrained and calm; no default template look.
5. Fonts: self-host a Latin text face plus **Noto Sans Gujarati** and **Noto Sans Devanagari** (or equivalents with a licence that allows it). Add `@font-face`, correct `unicode-range`, system fallback stack, and a `fonts/LICENSES.md`. Confirm each file's licence from its source; do not assume.
6. `i18n`: a typed key structure with English strings. `gu.ts` and `hi.ts` contain the same keys with **English text as placeholders** and a comment `// NEEDS HUMAN TRANSLATION`. Do not write Gujarati or Hindi UI wording yourself.
7. App shell: header, main region, footer with the disclaimer slot. No features yet.
8. Dev proxy or CORS to the backend on `:8000` (the backend already allows `http://localhost:5173`).
9. `frontend/scripts/check-offline.mjs`: scans `dist/` and fails if it finds any `http://` or `https://` reference to a host other than an allowlist (document the allowlist; e.g. XML namespace URIs in SVG).
10. `npm` scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `check:offline`.

**Acceptance checks**
- `npm run typecheck`, `lint`, `test`, `build`, `check:offline` all pass.
- `npm run dev` shows the shell; browser dev tools show **zero** requests to external hosts.
- Gujarati and Devanagari sample text renders in the bundled font (screenshot or described observation; if you cannot view it, say UNVERIFIED).
- `types.ts` reviewed against `backend/README.md` field by field; list any mismatch.

**Out of scope:** any feature UI, visual polish beyond tokens and shell, translation text.

---

## Phase 5: Text chat UI

**Why:** the first end-to-end user-visible slice, and the foundation for provenance display.

**Tasks**
1. `api/sse.ts`: parse a `fetch` response stream of server-sent events (the endpoint is `POST`, so `EventSource` cannot be used). Pure, tested: chunk boundaries inside events, multi-line data, unicode, unknown events ignored.
2. `api/http.ts`: `getConfig()`, `getReady()`, `chat()` (async iterator of typed events, abortable), `deleteSession()`.
3. Conversation state as a reducer with explicit message states (`streaming`, `complete`, `failed`, `stopped`). Tested.
4. Components: message list (user and assistant), composer, language select (from `/v1/config`, plus Automatic), source badge per assistant message (`safety` / `faq` / `model`, text label not colour alone), stop button, "new conversation" (calls `DELETE`), disclaimer bar, error and "server not ready" banners.
5. Answers appear sentence by sentence as they stream. Announce updates to assistive tech politely without re-reading the whole message each sentence.
6. Handle: network failure mid-stream, backend not ready, empty input, very long input (limit matches backend: 2000 characters), double submit.

**Acceptance checks** (run against the echo backend)
- Typing a question streams a reply progressively; badge shows `model`.
- "Do I have breast cancer?" shows a `safety` reply.
- Stop aborts the stream; the stopped message is marked as such.
- "New conversation" sends `DELETE` (204) and clears the view.
- Killing the backend mid-stream shows a clear error, not a frozen UI; restarting recovers without reload.
- Unit tests for `sse.ts` and the reducer pass; `typecheck`, `lint`, `build`, `check:offline` still pass.

**Out of scope:** voice, final visual design, translations.

---

## Phase 6: Voice UI

**Why:** the headline feature: speak, hear, and interrupt naturally.

**Needs:** Phase 2 done (real or fake speech working in the backend). Confirm decision **D7** (VAD library) after reading the installed package's actual API and checking that its model and WASM files can be bundled locally.

**Tasks**
1. **Contract fixtures first.** Create `contract/voice_frames.json` with golden examples: an utterance frame (turn id + PCM bytes) and an audio frame (turn + index + WAV header bytes), as hex. Add a backend test and a frontend test that both read it, so the two sides cannot drift.
2. `api/voiceSocket.ts`: connect, handle `ready`, send `start`, reconnect with backoff, typed incoming messages, binary frame decode. A **turn counter** owned by the client; `currentTurn` is the only turn whose messages are accepted. Everything else is dropped.
3. `audio/recorder.ts` + VAD: `getUserMedia` with echo cancellation and noise suppression, 16 kHz mono PCM16 output, speech start and end events, minimum utterance length, maximum utterance length matching `/v1/config`.
4. `audio/player.ts`: decode WAV, queue by sentence `index`, play in order with no gap or overlap, `flush()` stops immediately, and releases resources.
5. A single explicit **state machine** for the voice session: `idle → listening → capturing → thinking → speaking → listening`, plus `error` and `interrupted`. Pure and unit-tested, including: speech start during `speaking` sends `interrupt`, flushes audio, and starts a new turn; stale messages (wrong `turn`) are ignored; socket loss during any state recovers to `listening` or `error` cleanly.
6. UI: one clear primary control to start and stop talking; state indicator that does not rely on colour alone; live transcript; assistant text appearing sentence by sentence with the same provenance badges; mic-permission denied, no-microphone, and unsupported-browser states; a hint to use headphones if echo triggers false interruptions.
7. Developer panel (off by default, toggled): per-turn `stt_ms`, `first_sentence_ms`, `first_audio_ms`, `total_ms` from `done.metrics`.
8. `frontend/docs/voice-checklist.md`: a manual test script (see checks).

**Acceptance checks**
- Contract fixture tests pass on **both** backend and frontend.
- State machine and turn-gating unit tests pass.
- Manual checklist, executed and recorded: speak a question in each language → hear the answer; interrupt mid-answer → audio stops within about half a second, new question works; stay silent → no turn is sent; deny mic permission → clear message; stop the backend mid-answer → recovery; two rapid interruptions → no overlapping audio. Mark any item you could not perform as UNVERIFIED.
- Dev panel numbers match what `ws_smoke.py` shows for the same input.
- `typecheck`, `lint`, `build`, `check:offline` pass; the VAD assets load with the network off.

**Out of scope:** visual polish, text-to-voice for typed messages in the UI (the backend supports it; add only if the human asks), translations.

---

## Phase 7: Design and accessibility pass

**Why:** this is health information used by worried people. It must look calm and be usable by everyone.

**Tasks**
1. Agree the visual direction with the human before coding: palette, type scale, layout for mobile and desktop, the shape of the voice control and its states. Offer two or three concrete options (sketched or described), recommend one, wait for a choice.
2. Apply it to tokens and components. Avoid generic template styling (stock gradients, glass panels, decorative icons without meaning).
3. Responsive: phone width to wide desktop; no horizontal scroll; touch targets at least 44 px.
4. Accessibility: full keyboard operation, visible focus, correct landmarks and labels, polite live regions that do not spam, contrast AA in light and dark, respects `prefers-reduced-motion`, text scales to 200% without breaking, language attributes set on text in each script (`lang="gu"`, `lang="hi"`).
5. Add an automated accessibility check (for example axe via the test runner; confirm what is installable and works offline) and fix what it finds.
6. UI translations: **the human supplies** the Gujarati and Hindi strings. Wire them in; do not write them. Layout must handle longer strings.
7. Provide screenshots of the key states for the human to review.

**Acceptance checks**
- Automated accessibility check passes with no serious or critical findings; manual keyboard-only run-through recorded.
- Screenshots delivered: chat (each language), voice states (idle, capturing, thinking, speaking, error), mobile and desktop, light and dark.
- Contrast ratios for text and key controls listed with measured values.
- Gujarati and Devanagari text renders correctly everywhere, including headings and buttons.
- All prior checks still pass.

**Out of scope:** new features, backend changes.

---

## Phase 8: Packaging and one-command run

**Why:** a fresh clone must work, offline, by following one short document.

**Tasks**
1. Decide **D6** with the human. Default: in production the backend serves `frontend/dist` (static files with single-page-app fallback); in development, two processes.
2. Implement the choice. If static serving is added to the backend, keep it optional behind a setting and add a test.
3. One documented command each for: install, start in development, build and start in production. Cross-platform where practical; say plainly where it is not.
4. `scripts/doctor.py`: checks Python version, installed extras for configured backends, model files present in the local cache, `llama-server` reachable, FAQ index non-empty, frontend built; prints actionable messages.
5. Document offline model preparation: which models to download once, where they are cached, and the environment variables that stop network lookups (`HF_HUB_OFFLINE=1` and whatever the other libraries need; **verify each**).
6. Root `README.md`: what it is, requirements, quickstart, troubleshooting, the safety notice, and a link map to the other docs. Make the backend `.env.example` complete and accurate.
7. A clean-clone rehearsal: following only the README, from an empty directory.

**Acceptance checks**
- Clean-clone rehearsal succeeds; record each step and any README correction needed.
- With the network disabled after the one-time downloads, the app starts and a text and a voice conversation work.
- `doctor.py` flags a deliberately missing piece with a clear message, and passes when everything is present.
- All tests, typecheck, lint, build, offline check pass.

**Out of scope:** containers, installers, cloud deployment.

---

## Phase 9: Evaluation and safety-review tooling

**Why:** we can only say it works if we can measure it, and a clinician needs a practical way to review it.

**Tasks**
1. `backend/eval/run_eval.py`: reads a held-out file (`question`, `answer`, `lang`), calls the **running API** (`/v1/chat`), and records for each: reply text, sources used, similarity to the verified answer (embedding cosine using the configured embedder), latency. Output JSON.
2. Metrics module with unit tests: similarity summary, source mix (share `faq` / `model` / `safety`), per-language breakdown.
3. A **stress runner**: reads a file of `{"question", "expect": "answer" | "safety:<category>" | "refuse_or_defer"}` and reports pass or fail per item. Ship only clearly marked **EXAMPLE** items.
4. A **safety-rule probe runner** that checks the guard against a human-supplied list of phrases that must trigger and phrases that must not (false-positive check), per language.
5. `eval/make_review_sheet.py`: turns results into a CSV for human reviewers with columns for correctness, hallucination, tone, and notes; includes the model's reply and the verified answer side by side.
6. A Markdown report generator summarising a run (tables only; no claims beyond the numbers).
7. Run the whole thing against the echo model and the example files to prove the harness works.

**Acceptance checks**
- The harness runs end to end on example data and produces the JSON, the report, and the review CSV.
- Metric unit tests pass.
- The report states the model used, date, number of items, and exactly which files fed it.
- Nothing in the harness or the example files reads like real medical guidance.

**Out of scope:** writing real test questions, judging medical correctness, deciding pass thresholds (the human does).

---

## Phase 10: Plug in the fine-tuned model

**Why:** the point of the project. Mostly a file swap, plus measurement and honest comparison.

**Needs:** the human's merged fine-tuned model, a 500 to 1000 item held-out test set that was never trained on, and decisions D2 and D3 settled.

**Tasks** (human leads; agent assists and verifies)
1. Convert and quantise following `docs/finetune-handoff.md`. First confirm llama.cpp supports the base model's architecture. If it does not, report and agree an alternative server (vLLM or similar) behind the same OpenAI-compatible URL.
2. Serve it; point `SAHAYAK_LLM__BASE_URL` at it. No code change expected.
3. Compare the **prompt the server receives** with the training format using `dump_prompt.py`. Any difference is a bug in one of the two.
4. Run the Phase 9 evaluation for (a) the placeholder or base model and (b) the fine-tuned model on the same held-out set.
5. Tune `direct_threshold` and `context_threshold` with `tune_thresholds.py` on real probes. The human picks values.
6. Re-measure latency end to end on the target laptop and update the numbers in `product.md` and `memory.md`.
7. Run the full manual voice checklist in all three languages.
8. Prepare a short demo script and a one-page limitations note (what it cannot do, known weaknesses by language).

**Acceptance checks**
- Side-by-side evaluation report exists for base and fine-tuned on the same held-out data.
- Human reviewers have filled the review sheet for a sample; hallucination rate and wrong-fact rate are reported separately.
- Safety probes pass; no safety-guard bypass was introduced.
- Latency numbers on the target laptop recorded honestly against the `product.md` targets.
- `memory.md` updated, open decisions closed or carried forward with reasons.

**Out of scope:** further training, new features.

---

# Voice v2 track (Phases 11 to 16)

**Goal:** make the spoken conversation feel more like talking to a person, while staying fully local and fully
multilingual (Gujarati, Hindi, English).

**Where the ideas come from:** OpenAI's engineering post *"How we built a realtime system for responsive voice AI
in six months"* (3 Aug 2026, about GPT-Live). We borrow **system design ideas**, not the model. The post's biggest
gain is a full-duplex speech model with no turn detector, and we do not have an equivalent local model for
Gujarati and Hindi. Do not claim parity with it.

| Idea in the post | How it appears here |
|---|---|
| Stream audio continuously instead of one blob per turn | Phase 13: small PCM frames from speech start, STT runs while the user is still talking |
| Keep the media path separate from application logic | Phases 12 and 13: capture, VAD and playback stay small and fast; retrieval, LLM and safety stay behind queues |
| Delegation that does not block the conversation | Phase 14: fast paths (safety, verbatim FAQ) answer at once; a short spoken acknowledgement covers a slow model path |
| Provisional vs final view of the conversation | Phase 15: live partial transcript in the UI; only final text goes into history |
| Truncate unplayed audio on interruption | Phase 15: history records what the user actually heard |
| Warm sessions before they are needed | Phases 14 and 16: preload models, warm the LLM prompt cache, connect early |
| Better telemetry and realistic testing | Phases 11 and 16: per-stage timing and a repeatable clip set |

**Deliberately not adopted:** WebRTC and the WARP handshake (solve distance and scale, not a localhost app), a Go
media rewrite, and full-duplex speech-to-speech models. A time-boxed research spike on open full-duplex models is
allowed later only if the human asks, and only after confirming Indic-language support from the model card.

**Starting point (measured in Phase 2, CPU only, i5-11400H):** first audio about 5.5 s, of which Whisper
transcription alone is about 4.1 s, because STT only starts after the user stops. The `product.md` target of 4 s
is not met. Phase 13 attacks this directly. Do not state any improvement until it is measured.

## Rules that hold in every Voice v2 phase

- **Wire protocol changes need the human's approval first.** Write the proposal (message shapes, versioning, fallback
  to the old behaviour), stop, and wait. After approval, update `api/schemas.py`, `api/serialization.py`,
  `backend/README.md`, `frontend/src/api/types.ts` and `contract/` together. Keep the old utterance path working
  behind a setting until the new path is verified.
- **Test audio comes from the human.** Store clips only under a git-ignored directory (`backend/eval/voice_clips/`)
  with a reference transcript per clip. Never record, save or log real user audio or transcripts at runtime.
- **No Gujarati or Hindi text written by the agent.** This includes spoken acknowledgement phrases and UI strings.
  Build the mechanism with clearly marked `EXAMPLE` English placeholders; the human supplies and a native speaker
  reviews the real phrases.
- **No medical content in anything new.** Acknowledgement phrases must contain no medical statements, advice or numbers.
- **Safety path is never shortened or bypassed.** Early work on partial transcripts may prefetch or prepare, but the
  safety guard and the answer decision run on the **final** transcript only. Never answer from a partial.
- **Architecture rules from `CLAUDE.md` still apply:** new model or library means a new adapter behind a port chosen
  in `container.py`; `services/` never imports adapters; heavy imports stay inside adapter methods; blocking model
  calls go through `BlockingRunner`.
- **Verify, do not recall.** Every library, model name, licence, flag and API used from memory must be checked
  against installed source or official docs and recorded in `memory.md`.
- **Report numbers honestly:** hardware beside every measurement, spread across repeated runs, and an explicit
  "met / not met" against targets.

---

## Phase 11: Voice v2, instrumentation and baseline

**Why:** you cannot improve what you cannot see. Build a repeatable measurement before changing anything, so every
later phase can show a real before and after.

**Needs:** Phase 7 done and speech working (Phase 2). The human supplies 5 to 10 WAV clips per language (16 kHz mono
or convertible) with reference transcripts in `backend/eval/voice_clips/` (git-ignored), including a few with
natural pauses inside a sentence and a few very short ones.

**Tasks**
1. Add decisions **D11 to D16** to `memory.md` → *Open decisions*: D11 run Voice v2 before or after Phase 8 (default after); D12 streaming STT engine; D13 neural VAD library; D14 TTS voice per language; D15 acknowledgement phrases and who reviews them; D16 end-of-speech timing defaults.
2. Define the stage timeline in `memory.md`: speech end detected, utterance fully received, STT final, safety/retrieval decision, first LLM sentence, first TTS audio produced, first audio started playing in the browser. Mark which stages are server-side and which are client-side.
3. Propose, **without implementing**, any new fields needed in `done.metrics` or client-side timing. If a wire change is needed, follow the protocol-change rule above and wait for approval.
4. `backend/scripts/voice_bench.py`: sends each clip through `/v1/voice` the way `ws_smoke.py` does, repeats N times (default 3), and prints p50 and p95 per stage per language. Writes JSON to a git-ignored `backend/data/bench/`. Developer-eyes-only output.
5. Frontend: measure audio-callback interval jitter in the capture path and playback underruns in `AudioQueuePlayer`; show both in the dev panel. No behaviour change.
6. Record the baseline table (hardware, model versions, clip counts, spread across runs) in `memory.md` and in `docs/voice-baseline.md`.

**Acceptance checks**
- `voice_bench.py` runs end to end on the clip set and prints the per-language table.
- Three consecutive runs agree within a stated spread; the spread is reported.
- Dev panel shows jitter and underrun counts during a manual voice session.
- Baseline recorded with hardware and an explicit comparison to the `product.md` §8 targets.
- Tests pass; no behaviour change versus Phase 7 (state this and show the test count).

**Out of scope:** any latency or quality improvement, any protocol change that was not approved.

---

## Phase 12: Voice v2, better listening

**Why:** the current voice activity detection is a plain loudness threshold on a deprecated audio node. It cuts
people off during pauses, reacts to noise, and cannot tell a cough or "mm" from a real interruption. Knowing when to
speak and when to stay quiet is the single biggest part of feeling human.

**Needs:** Phase 11 done. Decision **D13** (neural VAD library) made after reading the installed package's actual
API, licence, and checking that its model and WASM files bundle locally. The earlier candidate was
`@ricky0123/vad-web`; Silero VAD is the likely underlying model. Verify, do not assume.

**Tasks**
1. Replace `ScriptProcessorNode` with an `AudioWorklet` for capture. Keep the output contract unchanged: 16 kHz mono PCM16.
2. Replace the RMS threshold VAD with the chosen neural VAD, bundled locally, loading with the network off.
3. End-of-speech logic: configurable silence hangover, adaptive so that a short pause inside a sentence does not end the utterance. Defaults come from measurement on the human-supplied clips (D16), not guesses. Expose the values in settings.
4. Barge-in guard: an interruption needs minimum speech duration and a speech probability above a threshold; very short sounds and backchannels do not interrupt. Make the thresholds configurable.
5. Echo handling: keep `echoCancellation`, add a check that detects the assistant's own playback being picked up, and prefer no interruption in that case. Test with and without headphones.
6. Update the voice state machine and its unit tests for the new events. Keep the pure reducer pure.
7. Synthetic-signal tests for the recorder logic (speech, silence, short blips, speech with an internal pause).
8. Update `frontend/docs/voice-checklist.md` with the new cases.

**Acceptance checks**
- Clips with internal pauses are sent as one utterance (show the count of sent utterances against the expected count).
- A speaker-playback run with no user speech produces zero false interruptions over a stated duration; record it with and without headphones, or mark the missing one UNVERIFIED.
- Real interruption still stops audio within about half a second; measure and record.
- VAD assets load with the network off; `check:offline` passes.
- Unit tests, `typecheck`, `lint`, `build` pass.

**Out of scope:** streaming audio to the server (Phase 13), server-side changes, new UI design.

---

## Phase 13: Voice v2, streaming input and streaming STT

**Why:** this attacks the real bottleneck. Today transcription starts only after the user stops, so about 4 s is
spent waiting. If transcription runs while the user is still speaking, most of that work is done by the time they
finish.

**Needs:** Phase 12 done. The human's clip set with reference transcripts per language.

**Tasks**
1. **Proposal first (wire protocol change).** Write `docs/voice-streaming-proposal.md`: binary audio-chunk frames
   (turn id, sequence number, PCM16), an end-of-speech message, server `partial_transcript` and final `transcript`
   messages, error cases, how late or lost chunks are handled, and how the client falls back to the existing
   one-blob utterance. **Stop and wait for approval before implementing.**
2. After approval, update the protocol everywhere at once (see the track rules) and extend `contract/voice_frames.json` with golden examples for each new frame, tested on both sides.
3. Add a streaming STT port in `domain/` and keep the existing STT port working. The old path stays selectable by setting.
4. Implement a streaming adapter (D12). Candidate approach: repeated decoding of a growing audio window with a stability rule that only commits text that stayed the same across passes, using the already installed `faster-whisper`. If IndicConformer can run in chunks, evaluate it too. **Check each library's real API and capabilities before relying on it.** Record findings in `memory.md`.
5. Speculative work on partials, strictly limited: the safety guard may be run on partials to warm its code path, and retrieval may be prefetched on a stable partial. The decision to answer is made only on the final transcript; if the final differs materially from the partial used, discard the prefetch. Never emit an answer sentence before the final transcript.
6. Frontend: stream frames from speech start; show the partial transcript visibly provisional (for example lighter style, announced politely to assistive tech only when final); replace with the final text.
7. Cancellation and interruption must still work mid-stream: interrupt during capture, interrupt during speaking, socket loss mid-utterance. Tests for each.
8. Measure on the clip set per language: word error rate (and character error rate for Gujarati and Hindi) against the human reference transcripts, and the time from end of speech to final transcript, old path vs new path.

**Acceptance checks**
- Protocol approved by the human before any implementation (record the approval in `memory.md`).
- Contract tests pass on both backend and frontend.
- New path produces a correct final transcript on the clip set; error rates reported per language, next to the old path's.
- End-of-speech-to-final-transcript time reported old vs new with hardware and spread. State plainly whether first audio improved and by how much, or that it did not.
- Interruption tests pass in all three states; no stale-turn playback.
- Switching the setting back restores the old behaviour and the old tests pass.
- All tests, `typecheck`, `lint`, `build`, `check:offline` pass.

**Out of scope:** TTS changes (Phase 14), UI polish, choosing a final STT winner without the numbers (the human decides D12).

---

## Phase 14: Voice v2, natural speaking

**Why:** after the transcript, the voice itself decides whether it feels human: how fast the first sound arrives, how
it sounds, and whether silence while the model thinks feels awkward.

**Needs:** Phase 11 done (Phase 13 helpful). Decisions **D14** and **D15**. Real acknowledgement phrases are supplied
by the human per language and reviewed by a native speaker.

**Tasks**
1. **TTS listening comparison.** Extend `tts_listen.py` to produce samples for every verifiable offline backend and language, using only the existing fixed strings in `services/messages.py`. Retry the Indic Parler adapter in an isolated environment, since its dependencies conflicted before (see `memory.md` item 5); report what works. Check any additional offline Indic TTS option against its model card and licence before adding it. The human listens and decides D14.
2. **First-audio sizing.** Make the segmenter's first-chunk behaviour configurable (for example a shorter first sentence or a clause-level first split) so the first sound starts earlier. Measure, with a test that proves normal sentences are not broken mid-word, and no Indic conjunct or danda handling regresses.
3. **Warm everything.** Preload STT, TTS and embedder at server start (not on first request), warm the LLM prompt cache with the system prompt, and report the startup time. Verify the real flags and settings for the serving engine in use (`llama-server` or Ollama) from its own help or docs.
4. **Spoken acknowledgement for the slow path.** Mechanism only: if the model path has not produced a first sentence within a configurable time, play one short, human-supplied acknowledgement phrase in the user's language. It must never play on the safety path or the verbatim FAQ path, and never more than once per turn. Phrases live in a separate reviewable file (like `safety_rules.yaml`), for example `resources/acknowledgements.yaml`, shipped with clearly marked `EXAMPLE` English placeholders only. If the UI needs to label it, propose the wire change (for example a new `source` value) and wait for approval.
5. Tests with fakes for the timing logic, the never-on-safety and never-on-FAQ rules, and once-per-turn.

**Acceptance checks**
- Listening sample set delivered for every backend and language that loads; Parler outcome reported honestly.
- `first_audio_ms` before and after, per language, with hardware and spread. Say if the `product.md` target is met or not.
- Startup warm time reported; first real request after startup shows no model-load delay.
- Acknowledgement tests pass; with the example file, no Gujarati or Hindi text was written by the agent.
- All tests pass; no regression in the safety path.

**Out of scope:** writing acknowledgement phrases in Gujarati or Hindi, choosing the final voice (the human decides), any change to what the model says.

---

## Phase 15: Voice v2, conversation state

**Why:** a human conversation has a shared sense of what was actually said and heard. Today a half-spoken answer and
a half-heard question can leave the history out of step with reality.

**Needs:** Phase 13 done.

**Tasks**
1. **Provisional and final views.** Keep two views in the frontend: a speculative live view (partial transcript, text being spoken) and the authoritative record (final transcript, sentences actually delivered). Reducer-based, pure, tested.
2. **Record what was heard.** On interruption, the client reports how far playback got (last fully played sentence index at minimum). The server stores in session history only the assistant text that was actually played, so the next answer does not refer to words the user never heard. Propose the wire change first and wait for approval. Do not claim word-level accuracy unless it is implemented and tested.
3. **Continuation grace window.** If the user resumes speaking shortly after the end-of-speech decision and before the reply starts, merge the new speech into the same utterance instead of cancelling and restarting. The window length is configurable; its default comes from the clip tests. Cover with state-machine tests.
4. Keep `Session.lock` guarantees: one turn at a time, cancelled turns still record correctly.
5. Update `frontend/docs/voice-checklist.md` and `backend/README.md` for every changed behaviour.

**Acceptance checks**
- Unit tests: partial replaced by final, interruption mid-answer stores only heard sentences, resumed speech within the window merges, resumed speech after the window starts a new turn.
- Manual: interrupt after the first sentence, then ask "what did you just say?" in the echo backend and show the history contains only the first sentence (or mark UNVERIFIED with the exact steps).
- Contract fixtures updated and passing on both sides.
- All tests, `typecheck`, `lint`, `build`, `check:offline` pass.

**Out of scope:** changing safety or FAQ behaviour, UI redesign.

---

## Phase 16: Voice v2, regression harness and startup experience

**Why:** voice quality regresses silently. Lock in what was gained, make the first second after clicking the mic fast,
and leave a way to check all of it again.

**Needs:** Phases 11 to 15 done.

**Tasks**
1. `backend/eval/voice_regress.py`: runs the clip set through the running server and reports, per language: transcript error rates, per-stage latency (p50 and p95), false and missed interruptions where the clips cover them, and utterance-splitting correctness. JSON output plus a Markdown report in the same style as Phase 9 (tables only, no claims beyond the numbers). States the models, date, item counts and exactly which files were used.
2. Extend `scripts/doctor.py` (Phase 8) to check: clip set present and non-empty, neural VAD assets present, streaming adapter loadable, models preloaded, acknowledgement file present and not still the `EXAMPLE` placeholders when a real language is configured.
3. **Fast start.** Open the voice WebSocket early (as soon as the voice view is reachable), prepare the audio context on the first user gesture, and preload VAD assets, so the first utterance does not pay setup cost. Measure click-to-listening time before and after.
4. Update `product.md` §8 latency numbers and `memory.md` with the final measured values and the hardware. Say plainly which targets are met and which are not.
5. Run the full manual voice checklist in all three languages, headphones and speakers, and record every item (UNVERIFIED for anything not performed).
6. Update the one-page limitations note: weak spots per language, noisy environments, echo, and anything measured as unreliable.

**Acceptance checks**
- `voice_regress.py` runs end to end and produces the JSON and the report; a deliberate regression (for example a very low silence hangover) makes the report show a visible difference.
- `doctor.py` flags a deliberately missing VAD asset and passes when complete.
- Click-to-listening time before and after, with hardware and spread.
- Numbers in `product.md` and `memory.md` match the latest runs.
- All tests, `typecheck`, `lint`, `build`, `check:offline` pass; the full app works with the network off.

**Out of scope:** new features, model changes, deciding pass thresholds (the human does).

---

# Image Check track (Phases 17 to 22)

**Goal:** let an adult upload a photo of a breast skin area and get back a **description of visible skin changes**,
produced locally by MedGemma 4B, followed by a fixed, human-reviewed message that always recommends seeing a clinician.
It is an awareness aid. It is **not** a diagnosis, **not** a cancer detector, and it never tells anyone they are fine.

**Why this track is different:** it reverses an earlier non-goal (image analysis). A wrong "nothing seen" can make
someone delay care, so safety design, wording and evaluation come **before** any code. The human's decision to accept
this scope is recorded in `memory.md` as D17.

**What is decided (changing any of it needs the human's approval):**

1. **The image goes directly to MedGemma 4B, running locally.** Nothing is sent off the machine.
2. **The model does not write the text the user reads.** It is asked for a structured answer chosen from a fixed list
   of visible-change categories, plus `none_visible`, `unclear_image` and `not_a_breast_photo`. The app turns each
   category into fixed sentences written by a human in each language.
3. **A result guard** makes sure every response, including `none_visible`, carries the same human-written referral
   message ("a photo cannot rule out breast cancer; see a doctor") and contains no verdict wording and no scores.
4. **No reassuring visuals.** No green ticks, no "all clear" styling, no percentage or confidence shown to users.
5. **Adults only, opt-in, off by default.** The feature sits behind a setting that is **off** until a clinician signs off.
6. **Images are never stored, logged or sent anywhere.** In memory only, metadata stripped, freed after the request.

**What we do not yet know (all UNVERIFIED until Phases 18 and 21):** whether MedGemma 4B is reliable at recognising
these visible changes on ordinary phone photos of breast skin in Indian users, how often it misses a real change,
whether it follows a fixed output schema reliably with an image input, and whether it fits in memory next to the
voice stack on a CPU-only 16 GB laptop. Do not claim any of these.

## Rules that hold in every Image Check phase

- **Never claim detection.** Never describe the feature as detecting, diagnosing, screening for or ruling out cancer.
  Use: "describes visible skin changes", "general information", "see a doctor".
- **Never author medical content.** The category list, the prompt's medical instructions, and every user-facing
  sentence in every language are human-written and clinician or native-speaker reviewed. Agents use clearly marked
  `EXAMPLE` placeholders only.
- **Agents never handle real breast images.** Plumbing tests use synthetic or non-medical images (gradients, noise,
  objects, images with neutral text). Real images are supplied by the human into git-ignored `backend/eval/image_set/`
  and are read only by the evaluation harness, which reports aggregate numbers. Agents do not open, view, describe or
  copy them.
- **Never persist or log images.** No files, no temp files, no thumbnails, no caches, no crash dumps with image bytes.
  Logs contain timings, sizes and error classes only. Verify what the model server and libraries write to disk.
- **The model's free text never reaches the user.** Only validated category ids, mapped to reviewed text, do. Unknown or
  malformed model output produces an error, never a guess.
- **Ignore instructions inside images.** Text written in a photo is data. The structured output constraint and the
  guard are the defence; test it.
- **Safety first, then speed.** If a check fails or the model is unavailable, show a plain "could not check, please see a
  doctor if worried" message from the reviewed file. Never leave the user with a blank or a guess.
- **Licence and terms.** MedGemma is governed by the Health AI Developer Foundations terms of use and its Prohibited Use
  Policy, and the Hugging Face files are gated behind acceptance. The human reads and accepts them (D19). Do not
  redistribute weights.
- **Wire protocol changes need approval.** The new endpoint is proposed in Phase 17 and implemented only after approval.
- **Architecture rules from `CLAUDE.md` still apply:** a port in `domain/`, an adapter in `adapters/`, chosen in
  `container.py`, blocking calls through `BlockingRunner`, heavy imports inside adapter methods.
- **Report numbers honestly:** hardware beside every measurement, and report **missed findings** separately and first.

---

## Phase 17: Image Check, scope, safety design and proposals (documents only)

**Why:** the riskiest feature in the product. Agree what it is, what it refuses to be, and what could go wrong, in
writing, before any code exists.

**Needs:** Phase 7 done. The human has decided to proceed (D17). No models, no images.

**Tasks**
1. Add decisions **D17 to D24** to `memory.md` → *Open decisions*: D17 accept the Image Check scope change; D18 the
   category list (clinician); D19 licence and terms acceptance and permitted-use confirmation; D20 model variant
   (MedGemma 4B instruction-tuned vs 1.5 4B); D21 resource strategy (always loaded vs loaded on demand, idle unload);
   D22 clinical reviewer and the source of the evaluation image set; D23 who writes the Gujarati, Hindi and English
   message texts and the native-speaker reviewer; D24 default state (off) and the conditions to switch it on.
2. Write `docs/image-check-design.md`: purpose, explicit non-purpose, user flow, what the user sees for each outcome,
   what is stored (nothing), and the decided design above.
3. **Threat model** in the same document: false reassurance, false alarm, non-breast or unusable images, explicit or
   minor-related images, instructions hidden in image text, leakage through logs, temp files, model-server caches,
   browser caches or object URLs, memory exhaustion from large images, the feature being mistaken for a diagnosis.
   For each: the mitigation, which phase builds it, and how it will be tested.
4. Read the official MedGemma model card (Intended Use, limitations) and the Health AI Developer Foundations terms and
   Prohibited Use Policy. Quote the relevant lines with links into the design document and list every open question
   for the human. If you cannot access a page, say UNVERIFIED.
5. Record the **proposed starting category list** below in the design document, marked clearly as *PROPOSED, needs
   clinical review*. Do not extend or reword it yourself.
6. **Proposal (wire change): the endpoint.** Suggested shape for the human to approve or change: `POST /v1/image-check`,
   `multipart/form-data` with one `image` file and an optional `language`; response `status` (`ok`,
   `unclear_image`, `not_a_breast_photo`, `unavailable`, `error`), `findings` (category ids), and `text` blocks taken from
   the reviewed messages file; no scores; documented size and type limits; errors with stable codes; the feature flag
   behaviour when off. Include a contract fixture plan.
7. Write the evaluation plan: what the human must supply (consented, licensed, clinician-labelled images; counts per
   category; the mix of skin tones and lighting that matches intended users), what will be reported (missed-finding
   rate first), and that the agent chooses no pass thresholds.
8. **Stop and wait** for the human's written approval of the design, the category list owner, and the API proposal.

**Proposed starting category list** *(PROPOSED, needs clinical review, not authored by the agent; the clinician decides D18)*:
redness; skin thickening or orange-peel texture; dimpling or puckering; scaling or crusting; nipple change; visible lump
or shape difference between the sides; open sore or ulcer; plus the three non-findings `none_visible`, `unclear_image`,
`not_a_breast_photo`.

**Acceptance checks**
- `docs/image-check-design.md` exists with every section above.
- Every statement about MedGemma or its terms is quoted with a link or marked UNVERIFIED.
- The human's approval of the design and the API proposal is recorded in `memory.md`.
- No code, settings or dependencies were changed.

**Out of scope:** any code, downloading models, evaluating images, writing user-facing medical text.

---

## Phase 18: Image Check, run MedGemma 4B locally and verify it

**Why:** prove the model runs on this laptop, accepts an image, returns structured output, and writes nothing to disk,
before building around it.

**Needs:** Phase 17 approved. D19 and D20 decided. The human has accepted the model terms and obtained the files (or
the agent has given the exact one-time download steps and the human ran them). Internet only for the one-time download.

**Tasks**
1. Confirm from the official model card the exact model id of the chosen variant and record it. Do not use an id from
   memory.
2. Choose and verify a local serving route that accepts an image: an OpenAI-compatible server (`llama-server` with its
   multimodal projector, Ollama, or a small transformers-based server). Check flags and the image request format against
   the installed server's own help or documentation. Record the exact command, the exact file names, where the files
   live, their licence, and how to pre-download them once.
3. Run it with the network disabled and record the result.
4. Verify whether the server can **constrain the output to a JSON schema** together with an image input. If it cannot,
   say so; that changes the guard design and the human decides.
5. Add `backend/scripts/image_probe.py`: sends images from a folder (synthetic or non-medical by default) to the model
   server and prints raw output, latency and peak memory. Developer-eyes-only. Saves nothing.
6. On the target laptop, measure cold load time, first-request latency, steady-state latency, and peak memory **with the
   voice stack and the text model also loaded**. Record hardware beside the numbers. Say whether it fits in 16 GB.
   Present the D21 options with the numbers; the human decides.
7. Check that the server writes no image data to disk (inspect its temp and cache directories before and after a run);
   record the result or mark UNVERIFIED with the steps.
8. Check that closing the connection stops generation.

**Acceptance checks**
- Probe run recorded: command, outputs on synthetic images, latency, memory, hardware.
- Offline run works, or the blocker is recorded.
- Schema-constrained output result recorded (works / does not work).
- Disk-write check recorded.
- Existing tests still pass; no app code changed.

**Out of scope:** app endpoints, UI, accuracy claims, real breast images, choosing the final variant without the human.

---

## Phase 19: Image Check, backend port, adapter, guard and endpoint

**Why:** the safety logic lives here. Build it so the model's words can never reach the user and no image can persist.

**Needs:** Phase 18 done. The Phase 17 API proposal approved. Message texts and the category list are placeholders
until the human supplies the real ones.

**Tasks**
1. `domain/`: an `ImageAnalyzer` port and plain result types (status, finding ids). No model or web imports.
2. `adapters/image_medgemma.py`: talks to the verified server route from Phase 18, behind the port, chosen only in
   `container.py`. Heavy imports inside methods. Calls go through `BlockingRunner` or an equivalent that allows only one
   image analysis at a time.
3. Image handling: allowed types and limits as approved; decode in memory; **strip all metadata by re-encoding**; shrink to
   the model's working size; never write to disk; free buffers after the request. Any new dependency (for example an image
   library) needs the usual justification, licence and offline check, recorded in `memory.md`.
4. `resources/image_prompt.txt`: the instruction sent with the image. The medical instructions in it are human-written;
   until supplied, ship a clearly marked `EXAMPLE` placeholder that contains no medical guidance.
5. `services/image_check.py`: orchestrates analyze → **strict validation** (only known category ids; reject anything
   else) → **guard** (always attach the referral text; never include model free text; never include scores) → response.
   Malformed or empty model output returns an error status, never a guessed result.
6. `resources/image_check_messages.yaml`: the reviewed text per language and per outcome, including the referral block
   and the "could not check" message. Ship `EXAMPLE` English placeholders only; do not write Gujarati or Hindi.
7. Endpoint exactly as approved, behind the setting `SAHAYAK_IMAGE_CHECK__ENABLED` (default **false**). When off it
   behaves as approved in Phase 17. `/ready` reports the image-check state. New errors subclass `SahayakError` with stable
   codes.
8. Logging: timings, sizes, status and error class only. Never image bytes, never findings text.
9. Tests with a fake analyzer: referral present in **every** status including `none_visible`; unknown ids rejected;
   malformed output becomes an error; model text never appears in the response; oversize and wrong type rejected; flag off
   returns the approved response; no file is created in the working or temp directory during a request; concurrent
   requests are serialised.
10. Contract fixtures for the new response shapes, read by backend tests (and by frontend tests in Phase 20).

**Acceptance checks**
- Full backend suite passes with the real count; new tests listed.
- With the real model server up: a synthetic image returns a well-formed response with the referral block; with the
  server down, the response is the reviewed "could not check" message and the rest of the server stays healthy.
- The no-files test passes and a manual before/after directory check is recorded.
- With the flag off, the endpoint behaves as approved and nothing loads the model.
- `ruff`, `mypy` clean in touched files.

**Out of scope:** the UI, accuracy evaluation, writing medical text or any Gujarati or Hindi text.

---

## Phase 20: Image Check, frontend

**Why:** a calm, honest screen that makes the limits impossible to miss and leaves nothing behind on the device.

**Needs:** Phase 19 done and the contract fixtures available.

**Tasks**
1. A separate "Image check" section reachable from the app shell, hidden when the backend reports the feature off.
2. Entry screen: a plain explanation, a prominent "not a diagnosis, a photo cannot rule out breast cancer" notice, a
   privacy statement (nothing is saved or sent anywhere), and an **adults-only confirmation** the user must tick. Use
   the i18n structure with `NEEDS HUMAN TRANSLATION` placeholders; do not write the wording yourself.
3. Picker: choose a file or use the phone camera. Show a preview held only in memory; revoke any object URL as soon as
   it is no longer needed; a clear "remove photo" control.
4. Submit with visible progress, an honest message about waiting, and a cancel control that aborts the request.
5. Results: render only what the backend returns. Findings as text labels, then the referral block, prominently, in
   **every** outcome. **Neutral styling for every outcome**: no green ticks, no "all clear" icons, no colour-only
   meaning, no scores. `unclear_image` gives retake guidance from the reviewed text.
6. Error and unavailable states from the reviewed text. No blank states.
7. "Clear and start over" removes the image, the result and any state. No `localStorage`, `sessionStorage`,
   IndexedDB or cache use for images or results; no image or result in a URL.
8. Accessibility: keyboard operable, labelled controls, polite live region for the result, focus management, contrast
   AA, reduced motion, works at 200% text, language attributes on Gujarati and Hindi text. Automated axe check passes.
9. Tests: the state reducer or machine (pure), results rendering from the contract fixtures including that the referral
   block is present for every status, object URL revocation, no storage API use, flag-off hiding.
10. `frontend/docs/image-check-checklist.md`: a manual script (see checks).

**Acceptance checks**
- Unit and accessibility tests pass; counts reported. `typecheck`, `lint`, `build`, `check:offline` pass.
- Manual checklist run and recorded with synthetic images only: consent required; preview and remove; submit; cancel;
  each status rendered with the referral block; browser storage empty afterwards (inspect and record); network panel shows
  only requests to the local backend. Mark anything not performed UNVERIFIED.
- Voice and text chat unaffected (existing tests pass).

**Out of scope:** reading results aloud, saving results, sharing results, any visual design that signals reassurance.

---

## Phase 21: Image Check, evaluation and clinical safety review

**Why:** this is the only way to know whether the feature is safe to show anyone. The question that matters most is how
often a real visible change is missed.

**Needs:** Phase 19 done (Phase 20 helpful). The human supplies an image set that is consented, licensed and labelled by
a clinician (D22) in `backend/eval/image_set/` with a manifest. The agent does not source, open or view these images.

**Tasks**
1. `backend/eval/image_eval.py`: reads the manifest (file, clinician-labelled categories, optional skin tone and lighting
   notes), calls the running API, and writes JSON. Reports aggregates only and never copies or displays images.
2. Metrics module with unit tests, reporting in this order: **missed-finding rate** (clinician labelled a finding, the
   model returned `none_visible`, `unclear_image` or a different finding); per-category recall and precision; rate of
   `unclear_image`; rate of `not_a_breast_photo` on true breast photos; breakdown by the supplied skin-tone and lighting
   notes; counts beside every rate.
3. Guard test run: in **every** response across the whole run, the referral block is present and no model free text
   appears. This must be 100 percent; any exception is reported first.
4. Adversarial pack: synthetic plumbing images made by the agent (blank, noise, non-medical objects, images with neutral
   text that tells the model to ignore its instructions) to confirm the structured output and guard hold. Real adversarial
   cases involving people are run by the human.
5. Load and memory behaviour: repeated requests, large images, requests while a voice conversation is running; record
   latency and peak memory with hardware.
6. `eval/make_image_review_sheet.py`: a CSV for the clinician with the model's categories beside the clinician label,
   columns for agreement and notes, identified by image id only.
7. A Markdown report (tables only, no claims beyond the numbers) stating the model and variant, date, data source, item
   counts per category, and exactly which files fed it.
8. Run everything end to end on synthetic plumbing data to prove the harness works. The real run is performed by the
   human, who gives the agent only the aggregate report to include.

**Acceptance checks**
- The harness runs end to end on synthetic data and produces the JSON, the report and the review sheet.
- Metric unit tests pass. The guard-presence check passes at 100 percent on the run.
- The report puts missed findings first and states the data source and counts.
- No image file was copied, committed or logged (show `git status` and the log check).
- The agent chose no pass or fail thresholds.

**Out of scope:** deciding whether the numbers are good enough (the clinician and the human do), sourcing images,
fine-tuning the model.

**Decision gate (D24):** the feature stays **off by default** and is labelled experimental unless the clinician
reviewer has reviewed the report and agrees in writing. Record the decision in `memory.md`.

---

## Phase 22: Image Check, integration, packaging and limitations

**Why:** make the feature easy to run, easy to switch off, and honestly described.

**Needs:** Phases 19 and 20 done (Phase 21 reported).

**Tasks**
1. Extend `scripts/doctor.py`: model files present, image model server reachable when the feature is on, the messages
   file present and not still `EXAMPLE` placeholders when a real language is configured, the flag state.
2. Offline preparation notes for the model: the gated download steps, where files live, environment variables that stop
   network lookups (verify each), and the resource strategy chosen in D21 with the measured memory numbers.
3. If D21 chose on-demand loading or idle unloading, implement it behind a setting with tests; otherwise do nothing.
4. Update the root `README.md` and the backend `.env.example` for the feature and its default-off flag, with the
   safety notice.
5. Update the one-page limitations note: what the feature is and is not, known weaknesses and failure modes from Phase 21,
   who it should not be used by, and the plain statement that it cannot rule out cancer.
6. A short demo script that uses only non-sensitive images.
7. Full regression: backend tests, frontend checks, the voice regression run if available, and the offline check, with
   the Image Check flag both off and on.

**Acceptance checks**
- `doctor.py` flags a deliberately missing piece with a clear message and passes when complete.
- The app starts and text, voice and image check all work with the network disabled after the one-time downloads
  (image check demonstrated with synthetic images).
- With the flag off, no image model is loaded and no image endpoint is reachable as approved.
- All tests, typecheck, lint, build and offline checks pass; counts reported.
- `memory.md` and `product.md` match the latest runs and decisions.

**Out of scope:** new features, enabling the feature by default, any claim about clinical performance beyond the
reviewed report.

---

## If something goes wrong

- A phase's acceptance check cannot pass for reasons outside its scope → stop, report with evidence, propose options. Do not weaken the check.
- A real library behaves differently from the adapter code → fix the adapter, add the finding to `memory.md` → *Gotchas*, and keep the port unchanged.
- The wire protocol must change → stop. A protocol change means updating `schemas.py`, `serialization.py`, `backend/README.md`, `frontend/src/api/types.ts`, and `contract/` together, with the human's approval.