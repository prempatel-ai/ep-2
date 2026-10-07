# Product: Sahayak

> Source of truth for **what** we are building and **why**. How it is built lives in `CLAUDE.md`
> and `memory.md`; the order of work lives in `phases.md`.
> Last updated: 2026-10-07.

## 1. One-liner

An offline voice and text assistant that answers **verified** breast cancer FAQs in **Gujarati, Hindi and
English**, with a natural-sounding voice that listens well, answers quickly and can be interrupted like a person.
It gives general information only.

## 2. Problem

People looking for breast cancer information in India often cannot easily get it in their own language, in
a form they can trust, by voice. Generic chatbots are unreliable on medical facts and weak in Indian
languages. This product answers from a **clinically verified FAQ set** (about 40,000 entries), uses a small
fine-tuned language model only where the FAQ does not already answer the question, and refuses what it must
not answer.

## 3. Users

| User | Needs |
|---|---|
| Patient / family member | Plain-language answers, in Gujarati/Hindi/English, by voice or text. Calm tone. A conversation that does not cut them off or make them repeat themselves. |
| Student / awareness volunteer | Quick, reliable general information. |
| The builder (final-year engineering student) | A working, demonstrable system that runs on a laptop, with a clean codebase. |

## 4. Goals

1. Answer questions from verified content, and show **where each answer came from** (safety / FAQ / model).
2. Hold a natural spoken conversation: speak early, allow interruption, sound human, not robotic.
3. Run **fully offline** on a laptop. No external APIs at runtime.
4. Be safe by construction: never diagnose, never interpret personal results, never give doses or treatment advice.
5. Be a codebase worth showing: layered, tested, documented, honest about what is verified.
6. Make the voice experience feel responsive and human **without** weakening safety or provenance: the system
   listens while the user is still speaking, knows when they have really finished, and never answers from half a sentence.

## 5. Non-goals

- Diagnosis, triage, treatment or medication advice, interpreting reports or scans.
- Image analysis (mammograms, histopathology).
- Accounts, login, cloud sync, analytics, or storing conversations.
- Languages beyond Gujarati, Hindi and English (for now).
- Replacing a doctor. Every refusal points to one.
- Matching or imitating any commercial voice product. The voice work borrows system design ideas from public
  engineering write-ups; it does not claim their model quality.
- Full-duplex speech-to-speech models as a core dependency (no verified local option for Gujarati and Hindi yet).

## 6. Core behaviour

Every question takes exactly one of these paths, in this order:

1. **Safety guard**: emergency, self-harm, or personal-medical request → fixed, reviewed reply. Model not called.
2. **Verbatim FAQ**: near-exact match to a verified FAQ → that answer, word for word. Model not called.
3. **Model**: otherwise the fine-tuned model answers, given related FAQs as reference when any are relevant.

Each answer sentence is labelled `safety`, `faq` or `model`; the UI shows this to the user.

For voice, the decision between these paths is always made on the **final** transcript. Partial transcripts may be
shown to the user and may be used to prepare work in advance, but they never decide an answer.

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

### Voice v2 requirements (Phases 11 to 16)

| ID | Requirement |
|---|---|
| V1 | The system listens with a neural voice activity detector bundled locally, not a plain loudness threshold. |
| V2 | A short pause inside a sentence does not end the user's turn; end-of-speech timing is configurable and chosen from measurement. |
| V3 | Short sounds and brief backchannels (a cough, "mm") do not interrupt the assistant; a real interruption does, and stops audio within about half a second. |
| V4 | Audio is streamed to the server while the user is still speaking, and transcription runs during speech, with a live partial transcript shown as provisional text. |
| V5 | Answers are decided only from the final transcript. A partial transcript is never answered. |
| V6 | If the model path is slow, one short spoken acknowledgement in the user's language may play. It never plays on the safety or verbatim FAQ paths, at most once per turn. The phrases are human-written and native-speaker reviewed. |
| V7 | The first sound of an answer starts as early as safely possible (earlier first chunk, warmed models, warmed prompt cache). |
| V8 | After an interruption, the conversation history contains only what the user actually heard. |
| V9 | If the user resumes speaking shortly after the system decided they had finished, the speech is merged into the same question instead of restarting. |
| V10 | The assistant's voice is chosen by listening comparison, per language, by the human. |
| V11 | The old one-utterance voice path stays available behind a setting until the streaming path is verified. |
| V12 | A repeatable test over a human-supplied set of recorded clips reports transcript error and per-stage latency per language. |

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Offline | No network calls at runtime from backend or frontend. No CDN fonts, scripts, images, or voice-model assets. |
| Privacy | Conversations in memory only, expire when idle, deletable. Question and answer text never logged. Audio never saved at runtime; test clips are human-supplied and kept out of git. |
| Latency | **Targets:** first audio ≤ 4 s on CPU-only laptop, ≤ 2 s with a GPU. **Measured in Phase 2 on an i5-11400H, CPU only: about 5.5 s, so the CPU target is NOT MET** (Whisper transcription alone about 4.1 s). Voice v2 aims to close the gap; do not claim any improvement until it is measured again. |
| Voice quality | Interruption stops audio within about half a second. No audio gaps or overlaps between sentences. No false interruptions from the assistant's own voice in a stated test. Measured, not assumed. |
| Accessibility | Keyboard-operable, screen-reader labels, visible focus, contrast AA, respects reduced motion, readable Gujarati and Devanagari type. |
| Quality | Services unit-tested without models. Every phase has runnable acceptance checks. Wire formats covered by shared fixtures read by both backend and frontend tests. |
| Portability | Runs on a typical student laptop; GPU optional. |

## 9. Experience principles (frontend)

- **Calm and trustworthy.** This is health information. Plain layout, generous spacing, no gimmicks.
- **Honest.** Show provenance, show limits, never imply a person is on the other end.
- **Voice first, text always available.** One clear primary action for talking.
- **Native-script typography.** Gujarati and Hindi are first-class, not an afterthought; fonts bundled locally.
- **No template look.** Deliberate type scale, restrained palette, real hierarchy. Avoid default gradient-and-glass styling.
- **Responsive without pretending.** The assistant may show provisional text and a short acknowledgement while it works,
  but it must stay clearly an assistant, and provisional text must look provisional.
- **Never cut the person off.** Waiting a moment longer is better than interrupting someone who is still thinking.

## 10. Content policy

- The assistant must never state a medical fact that is not supported by the verified FAQs or by the
  model's training on them. Anything unsure → refer to a doctor.
- **Agents and developers never write or alter medical content** (FAQ answers, safety patterns or replies,
  the system prompt's medical rules) without flagging it for human clinical review.
- Safety text and helpline numbers need clinician and native-speaker review before any real use.
- Spoken acknowledgement phrases and UI strings in Gujarati and Hindi are written by the human and reviewed by a
  native speaker. Agents use clearly marked placeholders only. Acknowledgement phrases contain no medical statements.

## 11. Success measures

- Held-out FAQ test set: answer similarity vs verified answers, hallucination rate, correct refusals (measured in Phase 9).
- Fine-tuned model beats the base model on the same test set (Phase 10).
- Measured first-audio latency on the target laptop (Phase 2 baseline, again in Phase 10 and Phase 16).
- A complete voice conversation in each language, with a working interruption, demonstrated live.
- Voice v2: on the human-supplied clip set, per language, report transcript error rate, end-of-speech-to-final-transcript
  time, first-audio time, utterance-splitting correctness, and false and missed interruptions, each compared with the
  Phase 11 baseline on the same hardware.

## 12. Status

| Part | State |
|---|---|
| Backend (FastAPI): safety, retrieval, orchestration, STT/TTS adapters, text + voice APIs | **Built and verified on real hardware** (Phases 0 to 3). 92 tests pass. IndicConformer and Indic Parler-TTS adapters remain unverified. |
| Speech | Faster-Whisper small and MMS-TTS verified on CPU. First audio about 5.5 s, CPU target not met. |
| Frontend | **Built through Phase 7**: text chat, voice UI with browser voice activity detection and gapless playback, design and accessibility pass. 24 unit tests pass. Packaging (Phase 8) not done. |
| FAQ data (40k) and index | Exists on the builder's side; **not yet loaded** into this repo (only the example file is indexed) |
| Fine-tuned model | Being trained by the builder; **not part of the agent's work** until Phase 10 |
| Voice v2 track (Phases 11 to 16) | **Planned, not started** |
| Clinical / native-speaker review | **Not done** |

## 13. Open questions

See `memory.md` → *Open decisions*.