/**
 * Audio recorder providing 16 kHz mono signed 16-bit PCM output.
 * Built-in threshold-based Voice Activity Detection (VAD) suitable for offline browser use
 * with echoCancellation and noiseSuppression enabled.
 */

export interface CaptureJitterMetrics {
  avgJitterMs: number;
  maxJitterMs: number;
  sampleCount: number;
}

export interface AudioRecorderOptions {
  sampleRate?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: (pcmData: Int16Array) => void;
  energyThreshold?: number;
  silenceDurationMs?: number;
  maxUtteranceMs?: number;
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private isRecording = false;
  private isSpeaking = false;
  private silenceTimer = 0;
  private speechStartTimer = 0;
  private bufferChunks: Float32Array[] = [];
  private options: Required<AudioRecorderOptions>;

  private lastProcessTime = 0;
  private maxJitterMs = 0;
  private jitterSumMs = 0;
  private jitterCount = 0;

  constructor(options: AudioRecorderOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate ?? 16000,
      onSpeechStart: options.onSpeechStart ?? (() => {}),
      onSpeechEnd: options.onSpeechEnd ?? (() => {}),
      energyThreshold: options.energyThreshold ?? 0.015,
      silenceDurationMs: options.silenceDurationMs ?? 800,
      maxUtteranceMs: options.maxUtteranceMs ?? 25000,
    };
  }

  async start(): Promise<void> {
    if (this.isRecording) return;

    const savedMicId =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("sahayak_selected_mic_id")
        : null;

    this.stream = await navigator.mediaDevices.getUserMedia({
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

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    // Buffer size 4096 gives ~85ms chunks at 48kHz
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);

    this.isRecording = true;
    this.isSpeaking = false;
    this.bufferChunks = [];
    this.silenceTimer = 0;
    this.speechStartTimer = 0;
    this.lastProcessTime = 0;
    this.maxJitterMs = 0;
    this.jitterSumMs = 0;
    this.jitterCount = 0;

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const input = e.inputBuffer.getChannelData(0);

      // Audio-callback interval jitter measurement (Phase 11)
      const now = performance.now();
      if (this.lastProcessTime > 0) {
        const actualIntervalMs = now - this.lastProcessTime;
        const expectedIntervalMs = (input.length / e.inputBuffer.sampleRate) * 1000;
        const jitter = Math.abs(actualIntervalMs - expectedIntervalMs);
        this.jitterSumMs += jitter;
        this.jitterCount++;
        if (jitter > this.maxJitterMs) {
          this.maxJitterMs = jitter;
        }
      }
      this.lastProcessTime = now;

      // Compute RMS energy
      let sum = 0;
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * input[i];
      }
      const rms = Math.sqrt(sum / input.length);

      const chunkMs = (input.length / e.inputBuffer.sampleRate) * 1000;

      if (rms > this.options.energyThreshold) {
        this.silenceTimer = 0;
        if (!this.isSpeaking) {
          this.speechStartTimer += chunkMs;
          if (this.speechStartTimer >= 150) {
            this.isSpeaking = true;
            this.options.onSpeechStart();
          }
        }
      } else {
        this.speechStartTimer = 0;
        if (this.isSpeaking) {
          this.silenceTimer += chunkMs;
          if (this.silenceTimer >= this.options.silenceDurationMs) {
            this.finishUtterance(e.inputBuffer.sampleRate);
            return;
          }
        }
      }

      if (this.isSpeaking) {
        this.bufferChunks.push(new Float32Array(input));
      }
    };
  }

  private finishUtterance(originalSampleRate: number): void {
    this.isSpeaking = false;
    this.silenceTimer = 0;
    if (this.bufferChunks.length === 0) return;

    // Concat chunks
    const totalLen = this.bufferChunks.reduce((acc, c) => acc + c.length, 0);
    const combined = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of this.bufferChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    this.bufferChunks = [];

    // Downsample to 16 kHz mono PCM16
    const pcm16 = this.downsampleToPcm16(combined, originalSampleRate, this.options.sampleRate);
    this.options.onSpeechEnd(pcm16);
  }

  private downsampleToPcm16(
    buffer: Float32Array,
    inputRate: number,
    targetRate: number,
  ): Int16Array {
    if (inputRate === targetRate) {
      const output = new Int16Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        const s = Math.max(-1, Math.min(1, buffer[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }

    const ratio = inputRate / targetRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const originIndex = Math.floor(i * ratio);
      const s = Math.max(-1, Math.min(1, buffer[originIndex]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    return result;
  }

  stop(): void {
    this.isRecording = false;
    this.isSpeaking = false;
    this.bufferChunks = [];

    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      try {
        void this.audioCtx.close();
      } catch {
        // ignore
      }
      this.audioCtx = null;
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
}

