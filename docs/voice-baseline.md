# Voice v2 Baseline and Instrumentation (Phase 11)

Living document recording the latency baseline, stage timeline, and instrumentation for Voice v2.

## 1. Hardware and Environment

- CPU: 11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz (6 cores, 12 logical processors)
- Memory: 16 GB RAM
- Execution Mode: CPU-only (no GPU acceleration enabled for baseline)
- Operating System: Windows 11 (64-bit)
- Python Version: 3.13.9
- Model Packages:
  - STT: faster-whisper 1.2.1, ctranslate2 4.8.2, av 19.0.1 (model: Systran/faster-whisper-small, int8 CPU)
  - TTS: transformers 5.18.0, torch 2.14.1 (models: facebook/mms-tts-guj, facebook/mms-tts-hin, facebook/mms-tts-eng)
  - Embeddings: sentence-transformers 6.1.0 (intfloat/multilingual-e5-small)
  - FAQ Store: chromadb 1.5.9

## 2. Stage Timeline

The end-to-end voice turn is broken down into distinct client-side and server-side stages:

| Stage # | Stage Name | Boundary / Meaning | Boundary Type |
|---|---|---|---|
| Stage 1 | Speech Start Detected | Browser VAD hears incoming speech energy above threshold | Client-side |
| Stage 2 | Speech End Detected | Silence timer expires (800 ms hangover), recording stopped | Client-side |
| Stage 3 | Utterance Fully Received | Binary 16 kHz mono PCM16 buffer received on server WebSocket | Server-side |
| Stage 4 | STT Final Ready | Whisper transcription complete, transcript event emitted | Server-side |
| Stage 5 | Safety and FAQ Routing | Safety check and FAQ lookup complete | Server-side |
| Stage 6 | First LLM Sentence Emitted | First sentence yielded by segmenter, sentence event emitted | Server-side |
| Stage 7 | First TTS Audio Produced | First sentence synthesised into WAV, audio binary emitted | Server-side |
| Stage 8 | First Audio Received | Client receives binary audio frame for index 0 | Client-side |
| Stage 9 | First Audio Playing | Client Web Audio API decodes and starts speaker playback | Client-side |

## 3. Latency Baseline (Phase 2 Measurements on CPU)

Initial measurements conducted with echo LLM on the target CPU hardware:

| Utterance Length | Input Audio Duration | STT Latency | First Sentence Text | First Audio Produced | Total Turn Time | Target (<= 4.0s) |
|---|---|---|---|---|---|---|
| Short | 1.87 s | 4146 ms | 4433 ms | 5532 ms | 7756 ms | NOT MET |
| Medium | 4.37 s | 4186 ms | 4471 ms | 5633 ms | 8878 ms | NOT MET |
| Long | 6.59 s | 4315 ms | 4590 ms | 5515 ms | 8780 ms | NOT MET |

Key observation: Whisper small on CPU requires approximately 4.1 seconds to transcribe audio after the user stops speaking. Because STT only began after speech ended, first audio latency is approximately 5.5 seconds, which does not meet the product target of 4.0 seconds on CPU. Voice v2 streaming input in Phase 13 is designed to overlap transcription with user speech.

## 4. Benchmark Clip Set Status

- Clip Directory: `backend/eval/voice_clips/`
- Current Status: UNVERIFIED (No clips present in directory)
- Required Clip Specification:
  - Audio container: WAV (RIFF)
  - Audio encoding: 16 kHz mono signed 16-bit PCM
  - Organization: Language folders (`gu/`, `hi/`, `en/`) or filenames ending in `_gu.wav`, `_hi.wav`, `_en.wav`
  - Transcripts: One UTF-8 `.txt` file per `.wav` clip containing reference text (for WER and CER tracking)
  - Recommended count: 5 to 10 clips per language, including short questions and questions with internal pauses

## 5. Client Instrumentation

Added in Phase 11 without behavior changes:
- Capture Jitter: Tracks interval variation between `onaudioprocess` callbacks in `AudioRecorder`. Average and peak jitter in milliseconds are reported in the developer panel.
- Playback Underruns: Tracks buffer queue starvation in `AudioQueuePlayer` when playback runs dry before the server finishes streaming all sentences. Reported in the developer panel.
