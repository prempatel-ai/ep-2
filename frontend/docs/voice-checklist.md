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
| 2 | Microphone Capture & VAD | User speaks; AudioWorklet neural VAD (Silero v5) detects speech probability and switches state to `capturing` | **PASS** |
| 3 | Silence Hangover & Pause Tolerance | User speaks with natural mid-sentence pauses; pause-tolerant hangover (800ms) preserves continuity; exactly one utterance sent | **PASS** |
| 4 | Barge-in Guard (Cough Rejection) | User coughs or makes short sound (<250ms) while assistant speaks; VAD misfire triggers and playback continues uninterrupted | **PASS** |
| 5 | Confirmed Interruption | User speaks continuously (>250ms) while assistant speaks; `AudioQueuePlayer.flush()` executes, interrupt sent, turn advances | **PASS** |
| 6 | Echo Handling | Assistant audio playback through speakers without headphones; echoCancellation and playback threshold prevent self-interruption | **PASS** |
| 7 | Streaming Response Playback | Server returns `transcript`, followed by progressive `sentence` events and binary audio frames; `AudioQueuePlayer` plays in order | **PASS** |
| 8 | No Speech Timeout | User stays silent after opening voice session; server returns `{"type": "no_speech"}`; UI cleanly recovers to `listening` | **PASS** |
| 9 | Dev Panel Telemetry | Dev panel shows latency, capture interval jitter, playback underruns, and active VAD settings | **PASS** |
| 10 | Settings Configuration | Settings modal allows configuring silence hangover and barge-in guard duration, persisted to localStorage | **PASS** |
| 11 | Offline Compliance | All VAD models, worklet bundles, and WASM run completely offline from local /vad/ assets (`check:offline` passed) | **PASS** |
