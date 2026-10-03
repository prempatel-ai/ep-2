# Product: Sahayak

> Source of truth for **what** we are building and **why**. How it is built lives in `CLAUDE.md`
> and `memory.md`; the order of work lives in `phases.md`.
> Last updated: 2026-10-03.

## 1. One-liner

An offline voice and text assistant that answers **verified** breast cancer FAQs in **Gujarati, Hindi and
English**, with a natural-sounding voice. It gives general information only.

## 2. Problem

People looking for breast cancer information in India often cannot easily get it in their own language, in
a form they can trust, by voice. Generic chatbots are unreliable on medical facts and weak in Indian
languages. This product answers from a **clinically verified FAQ set** (about 40,000 entries), uses a small
fine-tuned language model only where the FAQ does not already answer the question, and refuses what it must
not answer.

## 3. Users

| User | Needs |
|---|---|
| Patient / family member | Plain-language answers, in Gujarati/Hindi/English, by voice or text. Calm tone. |
| Student / awareness volunteer | Quick, reliable general information. |
| The builder (final-year engineering student) | A working, demonstrable system that runs on a laptop, with a clean codebase. |

## 4. Goals

1. Answer questions from verified content, and show **where each answer came from** (safety / FAQ / model).
2. Hold a natural spoken conversation: speak early, allow interruption, sound human, not robotic.
3. Run **fully offline** on a laptop. No external APIs at runtime.
4. Be safe by construction: never diagnose, never interpret personal results, never give doses or treatment advice.
5. Be a codebase worth showing: layered, tested, documented, honest about what is verified.

## 5. Non-goals

- Diagnosis, triage, treatment or medication advice, interpreting reports or scans.
- Image analysis (mammograms, histopathology).
- Accounts, login, cloud sync, analytics, or storing conversations.
- Languages beyond Gujarati, Hindi and English (for now).
- Replacing a doctor. Every refusal points to one.

## 6. Core behaviour

Every question takes exactly one of these paths, in this order:

1. **Safety guard**: emergency, self-harm, or personal-medical request → fixed, reviewed reply. Model not called.
2. **Verbatim FAQ**: near-exact match to a verified FAQ → that answer, word for word. Model not called.
3. **Model**: otherwise the fine-tuned model answers, given related FAQs as reference when any are relevant.

Each answer sentence is labelled `safety`, `faq` or `model`; the UI shows this to the user.

## 7. Functional requirements

| ID | Requirement |
|---|---|
| F1 | Text chat: type a question, answer streams in sentence by sentence. |
| F2 | Voice chat: speak, hear the answer; transcript and answer text shown alongside. |
| F3 | Interrupt: speaking or tapping while the assistant talks stops it immediately. |
| F4 | The user chooses a language (Gujarati / Hindi / English) or leaves it on automatic. |
| F5 | Answer provenance is visible per sentence or per answer. |
| F6 | A persistent notice states this is general information, not medical advice. |
| F7 | Emergency and self-harm messages get the fixed safe reply with the relevant number. |
| F8 | The user can end a conversation and have it forgotten immediately. |
| F9 | Clear states: listening, thinking, speaking, error, offline model server. |
| F10 | A developer view shows latency per turn (first sentence, first audio, total). |

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Offline | No network calls at runtime from backend or frontend. No CDN fonts, scripts, or images. |
| Privacy | Conversations in memory only, expire when idle, deletable. Question and answer text never logged. |
| Latency | **Targets, to be measured in Phase 2:** first audio ≤ 4 s on CPU-only laptop, ≤ 2 s with a GPU. Do not claim these are met until measured. |
| Accessibility | Keyboard-operable, screen-reader labels, visible focus, contrast AA, respects reduced motion, readable Gujarati and Devanagari type. |
| Quality | Services unit-tested without models. Every phase has runnable acceptance checks. |
| Portability | Runs on a typical student laptop; GPU optional. |

## 9. Experience principles (frontend)

- **Calm and trustworthy.** This is health information. Plain layout, generous spacing, no gimmicks.
- **Honest.** Show provenance, show limits, never imply a person is on the other end.
- **Voice first, text always available.** One clear primary action for talking.
- **Native-script typography.** Gujarati and Hindi are first-class, not an afterthought; fonts bundled locally.
- **No template look.** Deliberate type scale, restrained palette, real hierarchy. Avoid default gradient-and-glass styling.

## 10. Content policy

- The assistant must never state a medical fact that is not supported by the verified FAQs or by the
  model's training on them. Anything unsure → refer to a doctor.
- **Agents and developers never write or alter medical content** (FAQ answers, safety patterns or replies,
  the system prompt's medical rules) without flagging it for human clinical review.
- Safety text and helpline numbers need clinician and native-speaker review before any real use.

## 11. Success measures

- Held-out FAQ test set: answer similarity vs verified answers, hallucination rate, correct refusals (measured in Phase 9).
- Fine-tuned model beats the base model on the same test set (Phase 10).
- Measured first-audio latency on the target laptop (Phase 2, again in Phase 10).
- A complete voice conversation in each language, with a working interruption, demonstrated live.

## 12. Status

| Part | State |
|---|---|
| Backend (FastAPI): safety, retrieval, orchestration, STT/TTS adapters, text + voice APIs | **Built**. 83 tests pass using fakes. Routes, WebSocket and model adapters **not yet run on real hardware**. |
| Frontend | **Not started** |
| FAQ data (40k) and index | Exists on the builder's side; **not yet loaded** into this repo |
| Fine-tuned model | Being trained by the builder; **not part of the agent's work** until Phase 10 |
| Clinical / native-speaker review | **Not done** |

## 13. Open questions

See `memory.md` → *Open decisions*.
