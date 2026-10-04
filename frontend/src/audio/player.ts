/**
 * Audio player that decodes WAV audio frames and plays them sequentially in order.
 * Supports immediate flush() for barge-in interruption.
 */
export class AudioQueuePlayer {
  private audioCtx: AudioContext | null = null;
  private queue: Array<{ index: number; buffer: AudioBuffer }> = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private expectedIndex = 0;
  private onFinishedCallback?: () => void;

  constructor(onFinished?: () => void) {
    this.onFinishedCallback = onFinished;
  }

  private initCtx(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  async enqueueWav(index: number, wavBytes: Uint8Array): Promise<void> {
    const ctx = this.initCtx();
    const arrayBuffer = new ArrayBuffer(wavBytes.byteLength);
    new Uint8Array(arrayBuffer).set(wavBytes);

    try {
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.queue.push({ index, buffer: decodedBuffer });
      this.queue.sort((a, b) => a.index - b.index);

      if (!this.isPlaying) {
        this.playNext();
      }
    } catch {
      // Decode error; skip corrupt frame
    }
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.onFinishedCallback?.();
      return;
    }

    const nextItem = this.queue.shift();
    if (!nextItem || !this.audioCtx) return;

    this.isPlaying = true;
    const source = this.audioCtx.createBufferSource();
    source.buffer = nextItem.buffer;
    source.connect(this.audioCtx.destination);

    source.onended = () => {
      this.currentSource = null;
      this.playNext();
    };

    this.currentSource = source;
    source.start(0);
  }

  /**
   * Immediately stops playback, flushes pending audio frames, and resets queue.
   */
  flush(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop(0);
        this.currentSource.disconnect();
      } catch {
        // already stopped
      }
      this.currentSource = null;
    }
    this.queue = [];
    this.isPlaying = false;
    this.expectedIndex = 0;
  }

  close(): void {
    this.flush();
    try {
      this.audioCtx?.close();
    } catch {
      // ignore
    }
    this.audioCtx = null;
  }
}
