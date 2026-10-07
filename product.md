# Product: Sahayak

> Source of truth for **what** we are building and **why**. How it is built lives in `CLAUDE.md`
> and `memory.md`; the order of work lives in `phases.md`.
> Last updated: 2026-10-07.

## 1. One-liner

An offline voice and text assistant that answers **verified** breast cancer FAQs in **Gujarati, Hindi and
English**, with a natural-sounding voice that listens well, answers quickly and can be interrupted like a person.
An optional, off-by-default **Image Check** describes visible skin changes in an uploaded photo and always points to a
clinician. It gives general information only.

## 2. Problem

People looking for breast cancer information in India often cannot easily get it in their own language, in
a form they can trust, by voice. Generic chatbots are unreliable on medical facts and weak in Indian
languages. This product answers from a **clinically verified FAQ set** (about 40,000 entries), uses a small
fine-tuned language model only where the FAQ does not already answer the question, and refuses what it must
not answer.

## 3. Users

| User | Needs |
|---|---|
| Patient / family member | Plain-language answers, in Gujarati/Hindi/English, by voice or text. Calm tone. A conversation that does not cut them off or make them repeat themselves. A private way to describe a visible skin change they are worried about, with a clear push to see a doctor. |
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
7. Offer an **Image Check** that helps a person notice and describe visible skin changes **without ever acting as a
   diagnosis**: it never says there is no cancer, always recommends seeing a clinician, and keeps the image private.

## 5. Non-goals

- Diagnosis, triage, treatment or medication advice, interpreting reports or scans.
- Image analysis of mammograms, scans or histopathology.
- Any statement that a person does or does not have cancer, including from the Image Check. The Image Check describes
  visible skin changes only; it is not a detector, screener or classifier of disease, and it never gives all-clear
  messages, risk scores or percentages.
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

The **Image Check** is a separate path, not part of chat. The photo goes straight to MedGemma 4B running locally; the
model returns only categories from a fixed list; the app shows fixed, human-written text for those categories plus a
referral message that appears in every outcome. The model's own words never reach the user.

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

### Image Check requirements (Phases 17 to 22)

| ID | Requirement |
|---|---|
| I1 | The feature is **off by default** and is switched on only by a setting, after clinician sign-off (D24). When off, the UI hides it and no image model is loaded. |
| I2 | The user must confirm they are an adult and that they understand it is not a diagnosis before they can upload a photo. |
| I3 | The photo is analysed by MedGemma 4B running **locally**. Nothing is sent off the machine. |
| I4 | The model's output is restricted to a fixed list of visible-change categories plus `none_visible`, `unclear_image` and `not_a_breast_photo`. Anything else is an error, never a guess. |
| I5 | The user sees only fixed, human-written, clinician-reviewed text per category and language. The model's free text is never shown. |
| I6 | **Every** outcome, including `none_visible`, shows the same referral message: a photo cannot rule out breast cancer; see a doctor. |
| I7 | No reassurance in presentation: no green ticks, no all-clear wording, no scores, no percentages, no colour-only meaning. |
| I8 | `unclear_image` and `not_a_breast_photo` give plain retake or "this is not what I can look at" guidance from reviewed text. |
| I9 | If the model is unavailable or fails, the user sees a reviewed "could not check, please see a doctor if you are worried" message. |
| I10 | Images are held in memory only, metadata is stripped, and nothing is written to disk, logs, caches or browser storage. "Clear and start over" removes everything. |
| I11 | Instructions written inside an image are ignored. |
| I12 | Image analysis never blocks or degrades text or voice conversations. |
| I13 | An evaluation harness reports, first, how often a clinician-labelled finding was missed, plus per-category numbers, on a consented, licensed, clinician-labelled set supplied by the human. |

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Offline | No network calls at runtime from backend or frontend. No CDN fonts, scripts, images, or voice-model assets. |
| Privacy | Conversations in memory only, expire when idle, deletable. Question and answer text never logged. Audio never saved at runtime; test clips are human-supplied and kept out of git. **Images are never stored, logged or sent anywhere**; the model server and libraries are checked for hidden disk writes; evaluation images are human-supplied, git-ignored and never opened by agents. |
| Latency | **Targets:** first audio ≤ 4 s on CPU-only laptop, ≤ 2 s with a GPU. **Measured in Phase 2 on an i5-11400H, CPU only: about 5.5 s, so the CPU target is NOT MET** (Whisper transcription alone about 4.1 s). Voice v2 aims to close the gap; do not claim any improvement until it is measured again. |
| Voice quality | Interruption stops audio within about half a second. No audio gaps or overlaps between sentences. No false interruptions from the assistant's own voice in a stated test. Measured, not assumed. |
| Accessibility | Keyboard-operable, screen-reader labels, visible focus, contrast AA, respects reduced motion, readable Gujarati and Devanagari type. |
| Quality | Services unit-tested without models. Every phase has runnable acceptance checks. Wire formats covered by shared fixtures read by both backend and frontend tests. |
| Image Check resources | **To be measured in Phase 18:** cold load, per-image latency and peak memory on the CPU-only 16 GB laptop with the voice stack loaded. Do not claim it fits or is fast until measured. |
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
- **Image Check is plain and neutral.** Nothing in colour, icon or wording may suggest "you are fine". The limits and the
  advice to see a doctor are the most prominent things on the result screen.

## 10. Content policy

- The assistant must never state a medical fact that is not supported by the verified FAQs or by the
  model's training on them. Anything unsure → refer to a doctor.
- **Agents and developers never write or alter medical content** (FAQ answers, safety patterns or replies,
  the system prompt's medical rules) without flagging it for human clinical review.
- Safety text and helpline numbers need clinician and native-speaker review before any real use.
- Spoken acknowledgement phrases and UI strings in Gujarati and Hindi are written by the human and reviewed by a
  native speaker. Agents use clearly marked placeholders only. Acknowledgement phrases contain no medical statements.
- Image Check content (the category list, the instruction given to the model, and every sentence shown for each outcome
  in every language) is written by humans and reviewed by a clinician and a native speaker. Agents never write it and
  never handle real breast images.
- MedGemma is used under the Health AI Developer Foundations terms of use and its Prohibited Use Policy. The human
  confirms the intended use is permitted (D19) before any real use.

## 11. Success measures

- Held-out FAQ test set: answer similarity vs verified answers, hallucination rate, correct refusals (measured in Phase 9).
- Fine-tuned model beats the base model on the same test set (Phase 10).
- Measured first-audio latency on the target laptop (Phase 2 baseline, again in Phase 10 and Phase 16).
- A complete voice conversation in each language, with a working interruption, demonstrated live.
- Voice v2: on the human-supplied clip set, per language, report transcript error rate, end-of-speech-to-final-transcript
  time, first-audio time, utterance-splitting correctness, and false and missed interruptions, each compared with the
  Phase 11 baseline on the same hardware.
- Image Check: on a clinician-labelled set, the **missed-finding rate reported first**, per-category recall and
  precision with counts, the rate of unclear-image results, and 100 percent presence of the referral message in every
  response. The agent sets no pass thresholds; the clinician and the human decide whether the feature may be enabled.

## 12. Status

| Part | State |
|---|---|
| Backend (FastAPI): safety, retrieval, orchestration, STT/TTS adapters, text + voice APIs | **Built and verified on real hardware** (Phases 0 to 3). 92 tests pass. IndicConformer and Indic Parler-TTS adapters remain unverified. |
| Speech | Faster-Whisper small and MMS-TTS verified on CPU. First audio about 5.5 s, CPU target not met. |
| Frontend | **Built through Phase 7**: text chat, voice UI with browser voice activity detection and gapless playback, design and accessibility pass. 24 unit tests pass. Packaging (Phase 8) not done. |
| FAQ data (40k) and index | Exists on the builder's side; **not yet loaded** into this repo (only the example file is indexed) |
| Fine-tuned model | Being trained by the builder; **not part of the agent's work** until Phase 10 |
| Voice v2 track (Phases 11 to 16) | **Reported complete by the builder** (2026-10-07). Measured results and anything still unverified are recorded in `memory.md`. |
| Image Check track (Phases 17 to 22) | **Planned, not started.** Needs clinician involvement, a human-supplied image set, accepted model terms, and a decision on the memory budget before it can be enabled. Off by default. |
| Clinical / native-speaker review | **Not done** |

## 13. Open questions

See `memory.md` → *Open decisions*.