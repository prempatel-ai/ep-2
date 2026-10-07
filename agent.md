# Agent operating contract

For any autonomous coding agent (Antigravity, Claude Code, or another) working on Sahayak.
If your tool looks for a differently named instructions file (`AGENTS.md`, `GEMINI.md`, ...), copy this file to that name.

## 1. Read before you act

Every session, read in this order and do not skip:

1. `product.md`: what and why
2. `memory.md`: current state, decisions, gotchas, open questions
3. `phases.md`: find the **first phase not marked done**; that is your only scope
4. `CLAUDE.md`: architecture rules, commands, style

If these disagree with each other or with the code, **stop and report the conflict**. Do not choose silently.

## 2. Scope discipline

- Work on the current phase only. Do not start, prepare, or "while I'm here" touch a later phase.
- Do not refactor or reformat code outside the phase's files.
- Do not add features, endpoints, settings, or dependencies the phase does not list.
- If a task seems to need a change the phase did not anticipate, **write it down and ask**; do not improvise.
- Phases 11 to 16 (Voice v2) are reported complete by the human; do not reopen them unless asked.
- Phases 17 to 22 (Image Check) are an optional, safety-critical track. Start one only when the human names it. Phase 17 is documents only: write no code, add no settings, download no models, and stop for approval at its end.

## 3. Truthfulness (the rule most likely to be broken)

- Report only what you actually ran. Quote the command and the result.
- If you could not run something (no model, no GPU, no network, no microphone, no speakers, no real browser), say **UNVERIFIED** and give the exact command or manual steps the user should run.
- Never fabricate: package names or versions, model IDs, CLI flags, function signatures, benchmark numbers, test results, latency numbers, error rates.
- When you rely on a library's API from memory, say so and confirm against its documentation or installed source before building on it.
- "It compiles" is not "it works". "Tests pass" is only true for the tests that exist.
- Every measurement needs: hardware, number of runs, spread, and an explicit "met" or "not met" against the target. Do not round in our favour and do not claim an improvement you did not measure.
- Do not claim the assistant matches any commercial voice product. Ideas borrowed from public engineering posts are ideas, not equivalence.
- Never say, write or imply that the Image Check detects, diagnoses, screens for, or rules out cancer. Never state or estimate how accurate MedGemma 4B is on breast photos; that is UNVERIFIED until the human-run evaluation and the clinician's review exist.
- Report Image Check evaluation numbers with the **missed-finding rate first**, with counts, and set no pass thresholds yourself.

## 4. Do-not-touch without human sign-off

| Item | Why |
|---|---|
| `backend/src/sahayak/resources/safety_rules.yaml` (patterns, replies, numbers) | Safety-critical; needs clinician and native-speaker review |
| FAQ data (`backend/data/faqs.jsonl`) | Verified medical content; never edit, translate, or "clean" answers |
| Medical rules in `resources/system_prompt.txt` and `services/prompting.py` layout | Must match the fine-tuning format |
| Wire protocol (`api/schemas.py`, `api/serialization.py`, `backend/README.md`, `frontend/src/api/types.ts`, `contract/voice_frames.json`) | Contract between backend and frontend; change all together, only with approval |
| Spoken acknowledgement phrases (for example `resources/acknowledgements.yaml`) | Human-written and native-speaker reviewed; agents may only use clearly marked `EXAMPLE` placeholders |
| UI strings in `gu.ts` and `hi.ts` | Human-supplied translations only |
| Order of answering: safety guard, then verbatim FAQ, then model, decided on the final transcript | Safety design; a partial transcript must never decide an answer |
| Image Check category list, `resources/image_prompt.txt` medical instructions, and `resources/image_check_messages.yaml` (every sentence, every language) | Clinician and native-speaker reviewed; agents use clearly marked `EXAMPLE` placeholders only and may only label proposals PROPOSED, needs clinical review |
| Image Check guard behaviour: referral message in every outcome, no model free text, no scores, no reassurance styling | Core safety design of the feature; add tests, never loosen |
| `SAHAYAK_IMAGE_CHECK__ENABLED` default (false) and the decision to enable it | Needs clinician sign-off recorded in `memory.md` (D24) |
| The Image Check endpoint shape and its contract fixtures | Wire protocol; propose in Phase 17, implement only after approval |
| MedGemma model terms and licence acceptance | Human accepts (D19); never redistribute weights |

Adding a **test** for these is fine. Changing their behaviour is not.

## 5. Dependencies

- Prefer the standard library and what is already declared in `pyproject.toml` / `package.json`.
- A new dependency needs: why it is needed, what was considered, licence, and that it works **offline** after install. Record it in `memory.md`.
- Nothing may fetch from the network at runtime. No CDN links, remote fonts, analytics, or telemetry. This includes voice models: VAD models, WASM files, audio worklets and speech models must load from local files with the network off.
- For any model-based component (VAD, STT, TTS, image), also record: exact model name, where its files live, its licence, and how to pre-download it once. Gated models (such as MedGemma) also record who accepted the terms and where.
- An image library or any other new dependency for Image Check needs the usual justification, licence and offline check, plus confirmation that it can work purely in memory.

## 6. Privacy and safety in code

- Never log or persist user questions, transcripts, answers, audio, or images.
- No analytics. No third-party scripts.
- Do not weaken or bypass the safety guard, even for a demo or a test fixture.
- Do not add any behaviour that gives diagnosis, dosage, or treatment advice.
- Do not run the safety guard's decision, or any answer decision, on a partial transcript. Partials are for display and preparation only.
- Do not add behaviour that speaks filler or acknowledgements on the safety path or the verbatim FAQ path.
- Test audio clips are supplied by the human, stay in git-ignored `backend/eval/voice_clips/`, and are used by developer tools only. Never record, save or upload real user audio, and never generate synthetic speech to pretend it is a real person's recording.
- Images: never write image bytes anywhere (no files, temp files, thumbnails, caches, logs, crash dumps, browser storage). Check what the model server and libraries write to disk and report it.
- **Never open, view, describe, copy or commit real breast images.** Plumbing tests use synthetic or non-medical images. Real evaluation images are supplied by the human in git-ignored `backend/eval/image_set/` and read only by the evaluation harness, which outputs aggregate numbers.
- Never show model free text to a user. Never leave the referral message out of any Image Check outcome.

## 7. Definition of done (every phase)

A phase is done only when **all** are true:

1. Every task in the phase is complete or explicitly moved to `memory.md` → *Open decisions* with a reason.
2. Every acceptance check in the phase has been run and its result recorded (command + outcome).
3. The full test suite passes; the real count is reported.
4. No new lint or type errors in files you touched.
5. `memory.md` is updated: state, decisions, new gotchas, unverified items, log entry.
6. The phase checkbox in `phases.md` is ticked, with the date.
7. You have written the handoff (section 9).

For Image Check phases, also: the no-files check and the referral-in-every-outcome check have been run and their results recorded, nothing about real images was viewed or copied, and any claim about model quality is absent or backed by the clinician-reviewed report.

For voice phases, also: every item in `frontend/docs/voice-checklist.md` that you could not perform is marked UNVERIFIED with the exact manual steps, and every latency or error-rate claim is backed by a recorded run.

## 8. When to stop and ask

Stop and ask the user when:

- an acceptance check fails and the fix would change scope or a do-not-touch item;
- a library or model behaves differently from what the docs or this repo assume;
- you need a decision listed under *Open decisions*;
- you are about to delete files, rewrite history, or change the wire protocol;
- anything would send data off the machine;
- a voice change needs a new message type, a new field, or a new meaning for an existing one (write the proposal, then wait);
- you need real Gujarati or Hindi text, test clips, or reference transcripts that the human has not supplied;
- an Image Check task needs the category list, message text, a clinician decision, real images, model-terms acceptance, or a choice about memory budget (D17 to D24) that the human has not given;
- the model server cannot constrain its output to the agreed structure, writes image data to disk, or behaves differently from the verified route;
- anything about Image Check could make it read as a diagnosis or an all-clear.

Asking is cheap. A confident wrong guess in a health product is not.

## 9. Handoff format (end of every phase)

```
PHASE <n>: <name>: <DONE | BLOCKED>
Ran:         <commands and results>
Not run:     <anything UNVERIFIED, with the command or manual steps for the user to run>
Measured:    <numbers with hardware, runs and spread, and met / not met against targets; "none" if no measurement>
Changed:     <files added/modified>
Decisions:   <anything decided, and why>
Deviations:  <anything that differs from phases.md, and why>
Needs human: <reviews, data, choices, approvals, clips, phrases>
Next phase:  <n+1> is ready to start / blocked by <x>
```

## 10. Git hygiene

- One commit per coherent task; message states what and why. Branch per phase: `phase-<n>-<slug>`.
- Never commit: `.env`, `data/faqs.jsonl`, `data/chroma/`, model files (`*.gguf`, weights), audio recordings, `node_modules`.
- Also never commit: `backend/eval/voice_clips/`, `backend/data/bench/`, `backend/data/tts_samples/`, saved audio frames from smoke tests, and any file containing real transcripts.
- Also never commit: `backend/eval/image_set/`, any image used for evaluation or probing other than clearly synthetic ones, image-eval outputs that include file names tied to people, model weights or projector files (`*.gguf`, `*.safetensors`, `mmproj*`), and anything under the model server's cache.
- Do not force-push or rewrite history.
- Keep the working tree free of generated audio and benchmark output; check `git status` before every commit.