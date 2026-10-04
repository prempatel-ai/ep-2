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
- [ ] Phase 5: Text chat UI
- [ ] Phase 6: Voice UI
- [ ] Phase 7: Design and accessibility pass
- [ ] Phase 8: Packaging and one-command run
- [ ] Phase 9: Evaluation and safety-review tooling
- [ ] Phase 10: Plug in the fine-tuned model

**Skeleton complete = Phases 0 to 8.** Phases 9 and 10 turn it into something measured and real.

## How to run a phasef

1. Re-read `product.md`, `memory.md`, this file's section for the phase, and `CLAUDE.md`.
2. Create branch `phase-<n>-<slug>`.
3. Do the tasks. Build the smallest thing that meets the acceptance checks.
4. Run **every** acceptance check. Record command and result.
5. Update `memory.md` (state, decisions, gotchas, unverified items, log) and tick the box above with the date.
6. Output the handoff block from `agent.md` §9 and **stop**. Do not begin the next phase until told to.

## Rules that hold in every phase

- Nothing leaves the machine at runtime. No CDN assets, no analytics, no remote fonts.
- Never log or persist user text, transcripts, answers, or audio.
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

## If something goes wrong

- A phase's acceptance check cannot pass for reasons outside its scope → stop, report with evidence, propose options. Do not weaken the check.
- A real library behaves differently from the adapter code → fix the adapter, add the finding to `memory.md` → *Gotchas*, and keep the port unchanged.
- The wire protocol must change → stop. A protocol change means updating `schemas.py`, `serialization.py`, `backend/README.md`, `frontend/src/api/types.ts`, and `contract/` together, with the human's approval.
