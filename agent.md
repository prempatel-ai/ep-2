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

## 3. Truthfulness (the rule most likely to be broken)

- Report only what you actually ran. Quote the command and the result.
- If you could not run something (no model, no GPU, no network), say **UNVERIFIED** and give the exact command the user should run.
- Never fabricate: package names or versions, model IDs, CLI flags, function signatures, benchmark numbers, test results.
- When you rely on a library's API from memory, say so and confirm against its documentation or installed source before building on it.
- "It compiles" is not "it works". "Tests pass" is only true for the tests that exist.

## 4. Do-not-touch without human sign-off

| Item | Why |
|---|---|
| `backend/src/sahayak/resources/safety_rules.yaml` (patterns, replies, numbers) | Safety-critical; needs clinician and native-speaker review |
| FAQ data (`backend/data/faqs.jsonl`) | Verified medical content; never edit, translate, or "clean" answers |
| Medical rules in `resources/system_prompt.txt` and `services/prompting.py` layout | Must match the fine-tuning format |
| Wire protocol (`api/schemas.py`, `api/serialization.py`) | Contract with the frontend |

Adding a **test** for these is fine. Changing their behaviour is not.

## 5. Dependencies

- Prefer the standard library and what is already declared in `pyproject.toml` / `package.json`.
- A new dependency needs: why it is needed, what was considered, licence, and that it works **offline** after install. Record it in `memory.md`.
- Nothing may fetch from the network at runtime. No CDN links, remote fonts, analytics, or telemetry.

## 6. Privacy and safety in code

- Never log or persist user questions, transcripts, answers, or audio.
- No analytics. No third-party scripts.
- Do not weaken or bypass the safety guard, even for a demo or a test fixture.
- Do not add any behaviour that gives diagnosis, dosage, or treatment advice.

## 7. Definition of done (every phase)

A phase is done only when **all** are true:

1. Every task in the phase is complete or explicitly moved to `memory.md` → *Open decisions* with a reason.
2. Every acceptance check in the phase has been run and its result recorded (command + outcome).
3. The full test suite passes; the real count is reported.
4. No new lint or type errors in files you touched.
5. `memory.md` is updated: state, decisions, new gotchas, unverified items, log entry.
6. The phase checkbox in `phases.md` is ticked, with the date.
7. You have written the handoff (section 9).

## 8. When to stop and ask

Stop and ask the user when:

- an acceptance check fails and the fix would change scope or a do-not-touch item;
- a library or model behaves differently from what the docs or this repo assume;
- you need a decision listed under *Open decisions*;
- you are about to delete files, rewrite history, or change the wire protocol;
- anything would send data off the machine.

Asking is cheap. A confident wrong guess in a health product is not.

## 9. Handoff format (end of every phase)

```
PHASE <n>: <name>: <DONE | BLOCKED>
Ran:         <commands and results>
Not run:     <anything UNVERIFIED, with the command for the user to run>
Changed:     <files added/modified>
Decisions:   <anything decided, and why>
Deviations:  <anything that differs from phases.md, and why>
Needs human: <reviews, data, choices>
Next phase:  <n+1> is ready to start / blocked by <x>
```

## 10. Git hygiene

- One commit per coherent task; message states what and why. Branch per phase: `phase-<n>-<slug>`.
- Never commit: `.env`, `data/faqs.jsonl`, `data/chroma/`, model files (`*.gguf`, weights), audio recordings, `node_modules`.
- Do not force-push or rewrite history.
