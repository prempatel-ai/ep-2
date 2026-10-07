import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FrameProcessor, Message } from "@ricky0123/vad-web";
import { float32ToPcm16, AudioRecorder } from "./recorder";

describe("AudioRecorder and Neural VAD Logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("PCM16 Audio Conversion", () => {
    it("converts Float32Array [-1.0, 1.0] to signed 16-bit PCM correctly", () => {
      const input = new Float32Array([0, 1.0, -1.0, 0.5, -0.5, 1.5, -1.5]);
      const pcm16 = float32ToPcm16(input);

      expect(pcm16).toBeInstanceOf(Int16Array);
      expect(pcm16.length).toBe(input.length);
      expect(pcm16[0]).toBe(0);
      expect(pcm16[1]).toBe(32767); // Max positive signed 16-bit int
      expect(pcm16[2]).toBe(-32768); // Max negative signed 16-bit int
      expect(pcm16[3]).toBe(16383); // 0.5 * 32767 truncated in Int16Array
      expect(pcm16[4]).toBe(-16384); // -0.5 * 32768
      // Clamped values
      expect(pcm16[5]).toBe(32767);
      expect(pcm16[6]).toBe(-32768);
    });
  });

  describe("Recorder Configuration and Persistence", () => {
    it("applies default Voice v2 parameters (800ms hangover, 250ms min speech)", () => {
      const recorder = new AudioRecorder();
      const opts = recorder.getOptions();

      expect(opts.sampleRate).toBe(16000);
      expect(opts.redemptionMs).toBe(800);
      expect(opts.minSpeechMs).toBe(250);
      expect(opts.positiveSpeechThreshold).toBe(0.5);
      expect(opts.negativeSpeechThreshold).toBe(0.35);
      expect(opts.positiveSpeechThresholdDuringPlayback).toBe(0.65);
      expect(opts.preSpeechPadMs).toBe(450);
    });

    it("respects localStorage overrides for VAD settings", () => {
      localStorage.setItem("sahayak_vad_hangover_ms", "1000");
      localStorage.setItem("sahayak_vad_min_speech_ms", "350");
      localStorage.setItem("sahayak_vad_threshold", "0.6");

      const recorder = new AudioRecorder();
      const opts = recorder.getOptions();

      expect(opts.redemptionMs).toBe(1000);
      expect(opts.minSpeechMs).toBe(350);
      expect(opts.positiveSpeechThreshold).toBe(0.6);
    });
  });

  describe("Synthetic Signal VAD Tests (FrameProcessor)", () => {
    const frameSize = 512; // 32ms at 16 kHz
    const msPerFrame = 32;

    const createProcessor = (
      redemptionMs = 800,
      minSpeechMs = 250,
      speechFramesSet: Set<number>,
    ) => {
      let frameIndex = 0;
      const modelFunc = async () => {
        const isSpeech = speechFramesSet.has(frameIndex);
        frameIndex++;
        return {
          isSpeech: isSpeech ? 0.9 : 0.05,
          notSpeech: isSpeech ? 0.1 : 0.95,
        };
      };

      const fp = new FrameProcessor(
        modelFunc,
        () => {},
        {
          positiveSpeechThreshold: 0.5,
          negativeSpeechThreshold: 0.35,
          redemptionMs,
          minSpeechMs,
          preSpeechPadMs: 300,
          submitUserSpeechOnPause: false,
        },
        msPerFrame,
      );
      fp.resume();
      return fp;
    };

    it("detects continuous speech utterance and emits SpeechEnd", async () => {
      // 10 speech frames (320 ms), followed by 30 silence frames (960 ms)
      const speechSet = new Set<number>();
      for (let i = 0; i < 10; i++) speechSet.add(i);

      const fp = createProcessor(800, 250, speechSet);
      const events: string[] = [];
      const dummyFrame = new Float32Array(frameSize);

      for (let i = 0; i < 40; i++) {
        await fp.process(dummyFrame, (ev) => {
          if (ev.msg !== Message.FrameProcessed) {
            events.push(ev.msg);
          }
        });
      }

      expect(events).toContain(Message.SpeechStart);
      expect(events).toContain(Message.SpeechRealStart);
      expect(events).toContain(Message.SpeechEnd);
      expect(events.filter((e) => e === Message.SpeechEnd).length).toBe(1);
    });

    it("rejects short blip (cough/click) with VADMisfire and no SpeechEnd", async () => {
      // 3 speech frames = 96 ms, which is less than minSpeechMs (250 ms)
      const speechSet = new Set<number>([0, 1, 2]);
      const fp = createProcessor(800, 250, speechSet);
      const events: string[] = [];
      const dummyFrame = new Float32Array(frameSize);

      for (let i = 0; i < 35; i++) {
        await fp.process(dummyFrame, (ev) => {
          if (ev.msg !== Message.FrameProcessed) {
            events.push(ev.msg);
          }
        });
      }

      expect(events).toContain(Message.SpeechStart);
      expect(events).toContain(Message.VADMisfire);
      expect(events).not.toContain(Message.SpeechRealStart);
      expect(events).not.toContain(Message.SpeechEnd);
    });

    it("tolerates internal pause shorter than hangover duration and produces exactly one utterance", async () => {
      // Frame sequence:
      // - frames 0..9: speech (10 frames = 320 ms)
      // - frames 10..19: internal pause (10 frames = 320 ms, < 800 ms hangover)
      // - frames 20..29: speech (10 frames = 320 ms)
      // - frames 30..59: trailing silence (30 frames = 960 ms, >= 800 ms hangover)
      const speechSet = new Set<number>();
      for (let i = 0; i < 10; i++) speechSet.add(i);
      for (let i = 20; i < 30; i++) speechSet.add(i);

      const fp = createProcessor(800, 250, speechSet);
      const nonFrameEvents: string[] = [];
      let endAudioLength = 0;
      const dummyFrame = new Float32Array(frameSize);

      for (let i = 0; i < 60; i++) {
        await fp.process(dummyFrame, (ev) => {
          if (ev.msg !== Message.FrameProcessed) {
            nonFrameEvents.push(ev.msg);
            if (ev.msg === Message.SpeechEnd && "audio" in ev) {
              endAudioLength = ev.audio.length;
            }
          }
        });
      }

      // Exactly one SpeechEnd must be emitted despite the internal silence pause
      const speechEndEvents = nonFrameEvents.filter((e) => e === Message.SpeechEnd);
      expect(speechEndEvents.length).toBe(1);
      expect(nonFrameEvents).toContain(Message.SpeechStart);
      expect(nonFrameEvents).toContain(Message.SpeechRealStart);
      expect(nonFrameEvents).not.toContain(Message.VADMisfire);

      // The returned audio must contain both bursts plus the internal pause
      expect(endAudioLength).toBeGreaterThanOrEqual(20 * frameSize);
    });

    it("splits into two utterances when pause exceeds hangover duration", async () => {
      // Frame sequence:
      // - frames 0..9: speech (320 ms)
      // - frames 10..40: silence (31 frames = 992 ms, > 800 ms hangover) -> ends first utterance
      // - frames 41..50: speech (320 ms)
      // - frames 51..85: silence (35 frames = 1120 ms, > 800 ms hangover) -> ends second utterance
      const speechSet = new Set<number>();
      for (let i = 0; i < 10; i++) speechSet.add(i);
      for (let i = 41; i < 51; i++) speechSet.add(i);

      const fp = createProcessor(800, 250, speechSet);
      const nonFrameEvents: string[] = [];
      const dummyFrame = new Float32Array(frameSize);

      for (let i = 0; i < 86; i++) {
        await fp.process(dummyFrame, (ev) => {
          if (ev.msg !== Message.FrameProcessed) {
            nonFrameEvents.push(ev.msg);
          }
        });
      }

      const speechEndEvents = nonFrameEvents.filter((e) => e === Message.SpeechEnd);
      expect(speechEndEvents.length).toBe(2);
    });
  });
});
