# Voice UI Checklist & Manual Verification Script

This document records the end-to-end verification procedures for Sahayak's Phase 6 Voice UI on real hardware.

## 1. Automated Contract Verification

- **Binary Wire Decoding**: Verified with `src/api/voiceWire.test.ts` against golden fixture `contract/voice_frames.json`.
- **Backend Wire Decoding**: Verified with `backend/tests/test_wire_format.py` against golden fixture `contract/voice_frames.json`.
- **State Machine Transitions**: Verified with `src/features/voice/voiceStateMachine.test.ts` (speech start, thinking, speaking, barge-in turn advancement, and no-speech recovery).

## 2. Interactive Voice Session Checklist

| # | Check | Expected Result | Result |
|---|---|---|---|
| 1 | Connect to `/v1/voice` | Server emits `ready` frame; state transitions from `idle` to `listening`; Orb pulses ambiently in Sahayak deep teal | **PASS** |
| 2 | Microphone Capture & VAD | User speaks; recorder detects speech energy above threshold and switches Orb to `listen` (capturing) | **PASS** |
| 3 | Silence Detection & Processing | User stops speaking; recorder detects 800ms silence, downsamples to 16 kHz mono signed 16-bit PCM, and sends binary utterance; Orb enters `think` | **PASS** |
| 4 | Streaming Response Playback | Server returns `transcript`, followed by progressive `sentence` events and binary audio frames; `AudioQueuePlayer` decodes WAV frames and plays in order; Orb pulses in `speak` mode | **PASS** |
| 5 | Barge-In Interruption | User speaks or clicks "Interrupt" while assistant is speaking; `AudioQueuePlayer.flush()` executes immediately; client sends `{"type": "interrupt"}`; state advances to next turn cleanly | **PASS** |
| 6 | No Speech Timeout | User stays silent after opening voice session; server returns `{"type": "no_speech"}`; UI cleanly stays in or returns to `listening` | **PASS** |
| 7 | Latency Metrics Display | Developer panel (toggled top right) shows `stt_ms`, `first_sentence_ms`, `first_audio_ms`, and `total_ms` matching server `done.metrics` | **PASS** |
| 8 | Headphone Advice & Safety | Notice displayed informing user that headphones help avoid speaker echo from being detected as false interruptions | **PASS** |
| 9 | Offline Compliance | All WGSL shaders, WebGPU pipelines, and VAD audio nodes run completely offline without CDN requests (`check:offline` passed) | **PASS** |
