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
  private onSentenceStartCallback?: (index: number) => void;
  private underrunCount = 0;
  private turnStarted = false;
  private turnDone = false;

  constructor(
    onFinished?: () => void,
    onSentenceStart?: (index: number) => void,
  ) {
    this.onFinishedCallback = onFinished;
    this.onSentenceStartCallback = onSentenceStart;
  }

  public initCtx(): AudioContext {
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

  public unlock(): void {
    try {
      const ctx = this.initCtx();
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
    } catch {
      // AudioContext creation or resume might fail if strictly blocked
    }
  }

  public isSuspended(): boolean {
    return this.audioCtx ? this.audioCtx.state === "suspended" : false;
  }

  async enqueueWav(index: number, wavBytes: Uint8Array): Promise<void> {
    const ctx = this.initCtx();
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
    const arrayBuffer = new ArrayBuffer(wavBytes.byteLength);
    new Uint8Array(arrayBuffer).set(wavBytes);

    try {
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.turnStarted = true;
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
      // If turn is still generating on server but queue starved, count underrun
      if (this.turnStarted && !this.turnDone) {
        this.underrunCount++;
      }
      this.onFinishedCallback?.();
      return;
    }

    const nextItem = this.queue.shift();
    if (!nextItem || !this.audioCtx) return;

    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }

    this.isPlaying = true;
    this.onSentenceStartCallback?.(nextItem.index);
    const source = this.audioCtx.createBufferSource();
    source.buffer = nextItem.buffer;
    source.connect(this.audioCtx.destination);

    let ended = false;
    const onEnd = () => {
      if (ended) return;
      ended = true;
      this.currentSource = null;
      this.playNext();
    };

    source.onended = onEnd;

    // Safety fallback: if source.onended fails to fire (e.g. stalled audio clock)
    const timeoutMs = Math.ceil((nextItem.buffer.duration + 1.0) * 1000);
    setTimeout(() => {
      if (this.currentSource === source && !ended) {
        onEnd();
      }
    }, timeoutMs);

    this.currentSource = source;
    source.start(0);
  }

  /**
   * Called when server signals the turn is completely finished.
   */
  markTurnDone(): void {
    this.turnDone = true;
  }

  /**
   * Returns whether audio is actively playing through the speakers.
   */
  getPlaybackActive(): boolean {
    return this.isPlaying;
  }

  /**
   * Returns the count of playback underruns (queue starvation while awaiting frames).
   */
  getUnderrunCount(): number {
    return this.underrunCount;
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
    this.turnStarted = false;
    this.turnDone = false;
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
