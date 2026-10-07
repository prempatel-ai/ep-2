import { MicVAD, type RealTimeVADOptions } from "@ricky0123/vad-web";

/**
 * Converts 16 kHz Float32Array audio samples (range -1.0 to 1.0)
 * to 16 kHz mono signed 16-bit PCM (Int16Array).
 */
export function float32ToPcm16(buffer: Float32Array): Int16Array {
  const result = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return result;
}

export interface CaptureJitterMetrics {
  avgJitterMs: number;
  maxJitterMs: number;
  sampleCount: number;
}

export interface AudioRecorderOptions {
  sampleRate?: number;
  onSpeechStart?: () => void;
  onSpeechRealStart?: () => void;
  onVADMisfire?: () => void;
  onSpeechEnd?: (pcmData: Int16Array) => void;
  redemptionMs?: number;
  minSpeechMs?: number;
  positiveSpeechThreshold?: number;
  negativeSpeechThreshold?: number;
  positiveSpeechThresholdDuringPlayback?: number;
  preSpeechPadMs?: number;
  isPlaybackActive?: () => boolean;
  baseAssetPath?: string;
  onnxWASMBasePath?: string;
}

type VADInstance = Awaited<ReturnType<typeof MicVAD.new>>;

export class AudioRecorder {
  private vad: VADInstance | null = null;
  private isRecording = false;
  private isStarting = false;
  private shouldStop = false;
  private options: Required<AudioRecorderOptions>;
  private lastProcessTime = 0;
  private maxJitterMs = 0;
  private jitterSumMs = 0;
  private jitterCount = 0;
  private lastSpeechProb = 0;

  constructor(options: AudioRecorderOptions = {}) {
    // Read persisted VAD settings from localStorage if available
    let storedHangover = 800;
    let storedMinSpeech = 250;
    let storedThreshold = 0.5;

    if (typeof localStorage !== "undefined") {
      const h = Number(localStorage.getItem("sahayak_vad_hangover_ms"));
      if (!Number.isNaN(h) && h > 0) storedHangover = h;

      const m = Number(localStorage.getItem("sahayak_vad_min_speech_ms"));
      if (!Number.isNaN(m) && m > 0) storedMinSpeech = m;

      const t = Number(localStorage.getItem("sahayak_vad_threshold"));
      if (!Number.isNaN(t) && t > 0 && t <= 1) storedThreshold = t;
    }

    this.options = {
      sampleRate: options.sampleRate ?? 16000,
      onSpeechStart: options.onSpeechStart ?? (() => {}),
      onSpeechRealStart: options.onSpeechRealStart ?? (() => {}),
      onVADMisfire: options.onVADMisfire ?? (() => {}),
      onSpeechEnd: options.onSpeechEnd ?? (() => {}),
      redemptionMs: options.redemptionMs ?? storedHangover,
      minSpeechMs: options.minSpeechMs ?? storedMinSpeech,
      positiveSpeechThreshold: options.positiveSpeechThreshold ?? storedThreshold,
      negativeSpeechThreshold: options.negativeSpeechThreshold ?? Math.max(0.1, (options.positiveSpeechThreshold ?? storedThreshold) - 0.15),
      positiveSpeechThresholdDuringPlayback: options.positiveSpeechThresholdDuringPlayback ?? 0.65,
      preSpeechPadMs: options.preSpeechPadMs ?? 300,
      isPlaybackActive: options.isPlaybackActive ?? (() => false),
      baseAssetPath: options.baseAssetPath ?? "/vad/",
      onnxWASMBasePath: options.onnxWASMBasePath ?? "/vad/",
    };
  }

  async start(): Promise<void> {
    if (this.isRecording || this.isStarting) return;
    this.isStarting = true;
    this.shouldStop = false;

    this.lastProcessTime = 0;
    this.maxJitterMs = 0;
    this.jitterSumMs = 0;
    this.jitterCount = 0;
    this.lastSpeechProb = 0;

    const savedMicId =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("sahayak_selected_mic_id")
        : null;

    const vadOptions: Partial<RealTimeVADOptions> = {
      model: "v5",
      baseAssetPath: this.options.baseAssetPath,
      onnxWASMBasePath: this.options.onnxWASMBasePath,
      processorType: typeof AudioWorkletNode !== "undefined" ? "AudioWorklet" : "auto",
      positiveSpeechThreshold: this.options.positiveSpeechThreshold,
      negativeSpeechThreshold: this.options.negativeSpeechThreshold,
      redemptionMs: this.options.redemptionMs,
      minSpeechMs: this.options.minSpeechMs,
      preSpeechPadMs: this.options.preSpeechPadMs,
      startOnLoad: true,
      getStream: async () => {
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId:
                savedMicId && savedMicId !== "default"
                  ? { exact: savedMicId }
                  : undefined,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch {
          // Fallback if specific deviceId constraint is overconstrained or missing
          return await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        }
      },
      onSpeechStart: () => {
        this.options.onSpeechStart();
      },
      onSpeechRealStart: () => {
        // Echo guard: if assistant audio is actively playing through speakers,
        // suppress false triggers unless speech probability exceeds the higher playback threshold
        if (
          this.options.isPlaybackActive() &&
          this.lastSpeechProb < this.options.positiveSpeechThresholdDuringPlayback
        ) {
          return;
        }
        this.options.onSpeechRealStart();
      },
      onVADMisfire: () => {
        this.options.onVADMisfire();
      },
      onSpeechEnd: (audio: Float32Array) => {
        const pcm16 = float32ToPcm16(audio);
        this.options.onSpeechEnd(pcm16);
      },
      onFrameProcessed: (probs, frame) => {
        this.lastSpeechProb = probs.isSpeech;

        // Callback interval jitter tracking (Phase 11 and Phase 12)
        const now = performance.now();
        if (this.lastProcessTime > 0) {
          const actualIntervalMs = now - this.lastProcessTime;
          const expectedIntervalMs = (frame.length / 16000) * 1000;
          const jitter = Math.abs(actualIntervalMs - expectedIntervalMs);
          this.jitterSumMs += jitter;
          this.jitterCount++;
          if (jitter > this.maxJitterMs) {
            this.maxJitterMs = jitter;
          }
        }
        this.lastProcessTime = now;
      },
    };

    try {
      const instance = await MicVAD.new(vadOptions);
      if (this.shouldStop) {
        await instance.destroy().catch(() => {});
        return;
      }
      this.vad = instance;
      this.isRecording = true;
    } finally {
      this.isStarting = false;
    }
  }

  stop(): void {
    this.shouldStop = true;
    this.isRecording = false;
    if (this.vad) {
      const instance = this.vad;
      this.vad = null;
      void instance.destroy().catch(() => {});
    }
  }

  async destroy(): Promise<void> {
    this.shouldStop = true;
    this.isRecording = false;
    if (this.vad) {
      const instance = this.vad;
      this.vad = null;
      await instance.destroy();
    }
  }

  getJitterMetrics(): CaptureJitterMetrics {
    const avg = this.jitterCount > 0 ? this.jitterSumMs / this.jitterCount : 0;
    return {
      avgJitterMs: avg,
      maxJitterMs: this.maxJitterMs,
      sampleCount: this.jitterCount,
    };
  }

  getOptions(): Required<AudioRecorderOptions> {
    return { ...this.options };
  }
}
