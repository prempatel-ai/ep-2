# Sahayak backend

An offline voice and text assistant that answers **verified** breast cancer FAQs in Gujarati, Hindi and English. It gives general information only: it never diagnoses, interprets a person's results, or advises on treatment or doses.

Everything runs locally. Your fine-tuned language model is the one piece that plugs in from outside, through an OpenAI-compatible HTTP endpoint (for example `llama-server`).

## How a question is answered

```
question ─▶ safety guard ─▶ FAQ lookup ─┬─ near-exact match ─▶ verified answer, verbatim
            (fixed replies)             ├─ related entries ──▶ language model + those entries as reference
                                        └─ nothing relevant ─▶ language model alone
```

1. **Safety guard** (`resources/safety_rules.yaml`): emergencies, self-harm, and requests for a personal diagnosis or dose get a fixed, reviewable reply. The model is never called.
2. **Verbatim FAQ answers**: when a question almost exactly matches a verified FAQ, its answer is returned as written. No model, so no hallucination, and it is the fastest path.
3. **Model**: otherwise the model answers, with related FAQs supplied as reference.

Each sentence of the answer carries its `source` (`safety`, `faq` or `model`) so the UI can show where it came from.

## Layout

```
src/sahayak/
  domain/       plain types and the ports (interfaces) the services depend on
  services/     all the logic; no web or model-library imports
    conversation.py  safety → retrieval → model, streamed as sentences
    turns.py         a full turn (STT → answer → TTS) as a stream of events
    segmenter.py     streamed text → sentences, for speaking early
    safety.py  retrieval.py  prompting.py  sessions.py  faq_loader.py ...
  adapters/     one file per external model or library, behind a port
  api/          FastAPI routes, request schemas, wire serialisation
  container.py  builds everything from settings; the only place adapters are chosen
  config.py     typed settings from environment / .env
tests/          81 tests, no model or network needed
```

The rule that keeps this maintainable: **services never import adapters.** Swapping Whisper for IndicConformer, or MMS for Parler, is a config change.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,rag,stt-whisper,tts-mms]"
cp .env.example .env
```

Put your verified FAQs in `data/faqs.jsonl`, one JSON object per line:

```json
{"question": "...", "answer": "...", "lang": "gu"}
```

`lang` is optional (`gu`, `hi`, `en`). Then build the search index:

```bash
sahayak-index
```

The loader drops exact duplicates and **warns about questions that appear twice with different answers**; resolve those by hand, since this is medical content.

## Run

**Without your model yet** (to build and test the UI): set `SAHAYAK_LLM__BACKEND=echo`. The echo model streams a placeholder reply, and everything else (safety, retrieval, speech) works for real.

**With your fine-tuned model:**

```bash
llama-server -m models/model-q4_k_m.gguf --port 8080 -c 2048
python -m sahayak            # or: uvicorn sahayak.main:create_app --factory
```

Plugging the model in changes nothing else. See *Connecting your fine-tuned model* below.

Useful settings while developing: `SAHAYAK_STT__BACKEND=disabled` and `SAHAYAK_TTS__BACKEND=disabled` for text only; `SAHAYAK_RETRIEVAL__BACKEND=disabled` to run without an index.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/ready` | 503 until the model server and FAQ index are usable |
| GET | `/v1/config` | languages, voice availability, audio format (for the UI) |
| POST | `/v1/chat` | typed question, answer streamed as server-sent events |
| DELETE | `/v1/sessions/{id}` | forget a conversation now |
| WS | `/v1/voice` | voice (and optionally text) conversation |

### `POST /v1/chat`

Body: `{"text": "...", "session_id"?: "...", "language"?: "gu|hi|en"}`

Events: `session` (once), `sentence` (one per sentence: `index`, `text`, `source`), `done` (`source`, `metrics`), or `error` (`code`, `message`).

### `WS /v1/voice`

The browser decides when the user starts and stops speaking and sends **one binary frame per utterance**: 16 kHz, mono, signed 16-bit little-endian PCM.

| Direction | Frame | Meaning |
|---|---|---|
| server → client | `{"type":"ready","session_id","voice","input_sample_rate"}` | sent on connect |
| client → server | `{"type":"start","session_id"?,"language"?}` | optional: resume a session / fix the language (`null` = auto-detect) |
| client → server | binary PCM16 | an utterance; starts a turn |
| client → server | `{"type":"text","text","speak"}` | typed message, optionally answered with speech |
| client → server | `{"type":"interrupt"}` | stop the current reply (barge-in) |
| server → client | `{"type":"transcript","text","language"}` | what was heard |
| server → client | `{"type":"sentence","index","text","source"}` | answer text, as soon as each sentence exists |
| server → client | binary: 4-byte big-endian `index` + WAV | speech for that sentence |
| server → client | `{"type":"done","source","metrics"}` | turn finished, with latencies |
| server → client | `{"type":"no_speech"}` / `{"type":"interrupted"}` / `{"type":"error","code","message"}` | |

Sending a new utterance or message while a reply is playing cancels the reply, stops the model generating, and starts the new turn. What was actually said is kept in the conversation history.

Errors use stable codes: `invalid_request`, `invalid_audio`, `voice_unavailable`, `llm_unavailable`, `stt_failed`, `tts_failed`.

## Connecting your fine-tuned model

1. Merge the LoRA adapter, convert to GGUF, quantise (llama.cpp's `convert_hf_to_gguf.py` and `llama-quantize`). Confirm llama.cpp supports your base model's architecture; if it does not, serve the merged model with vLLM or another OpenAI-compatible server instead.
2. Serve it and point `SAHAYAK_LLM__BASE_URL` at it.
3. **Match the prompt format used in training.** `services/prompting.py` builds the system message (system prompt, `Reply in <language>.`, and an optional reference block). If your training data used a different layout, change that file or retrain. A mismatch is the most common cause of rambling or off-format answers.

Training with the reference block included in a share of examples teaches the model to use retrieved FAQs. If you train without it, set `SAHAYAK_RETRIEVAL__CONTEXT_THRESHOLD=1.0` so the model never receives the block and retrieval only powers the verbatim shortcut.

## Choices worth knowing

- **Privacy.** Conversations live in memory only, expire after 30 minutes idle, and are dropped on `DELETE`. Question and answer text is never logged; logs hold timings and error details.
- **Latency.** Answers stream sentence by sentence; each finished sentence is synthesised while the model writes the next. `done.metrics` reports `first_sentence_ms` and `first_audio_ms` so you can measure the real figure on your laptop.
- **Thresholds.** `direct_threshold` (default 0.90) decides when an FAQ is quoted verbatim. Tune it on your held-out questions: too low and loosely related answers are quoted, too high and the shortcut never fires.
- **Language.** An explicit language from the UI always wins. Otherwise STT's detection is used, then script detection (Gujarati vs Devanagari vs Latin). Whisper confuses Hindi and Gujarati on short clips; let the user pick their language.
- **One reply at a time per session.** Turns on a session are serialised.

## Testing

```bash
pytest                                     # or: PYTHONPATH=src python -m unittest discover -s tests
```

The tests cover the services and the wire format using fakes: sentence segmentation (including that chunking never changes the result), safety rules in all three languages, retrieval thresholds, sessions, the turn pipeline's event order, failure propagation, and cancellation leaving no tasks or locks behind.

**Not covered here, because they need real models or the web stack:** the FastAPI routes and WebSocket handler, and the Whisper, IndicConformer, MMS, Parler, Chroma and sentence-transformers adapters. Check these first when you run it on your machine: start the server, hit `/ready`, run `POST /v1/chat`, then try the voice socket. The IndicConformer and Parler adapters follow their model cards as I know them and may need small call-signature changes.

## Before real users

- Have a clinician review `safety_rules.yaml` and every verified FAQ answer, and a native speaker review the Hindi and Gujarati replies.
- Verify the helpline numbers in the safety rules.
- Show a "general information, not medical advice" notice in the UI.
