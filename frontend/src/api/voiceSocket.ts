import type {
  WsServerMessage,
  WsClientMessage,
  LanguageCode,
} from "./types";
import { decodeAudioFrame, encodeUtteranceFrame } from "./voiceWire";

export interface VoiceSocketCallbacks {
  onReady?: (sessionId: string, voiceAvailable: boolean) => void;
  onTranscript?: (text: string, language: LanguageCode) => void;
  onSentence?: (index: number, text: string, source: string) => void;
  onAudio?: (index: number, wavBytes: Uint8Array) => void;
  onDone?: (source: string | null, metrics: unknown) => void;
  onNoSpeech?: () => void;
  onInterrupted?: () => void;
  onError?: (code: string, message: string) => void;
  onDisconnect?: () => void;
}

export class VoiceSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: VoiceSocketCallbacks;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  constructor(callbacks: VoiceSocketCallbacks, url?: string) {
    this.callbacks = callbacks;
    const defaultUrl = (process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000") + "/v1/voice";
    this.url = url || defaultUrl;
  }

  connect(sessionId?: string, language?: LanguageCode | null): void {
    this.shouldReconnect = true;
    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        if (sessionId || language) {
          this.sendMessage({
            type: "start",
            session_id: sessionId,
            language: language,
          });
        }
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data) as WsServerMessage;
            this.handleTextMessage(msg);
          } catch {
            // ignore malformed frame
          }
        } else if (event.data instanceof ArrayBuffer) {
          try {
            const { index, wavBytes } = decodeAudioFrame(event.data);
            this.callbacks.onAudio?.(index, wavBytes);
          } catch {
            // ignore malformed binary frame
          }
        }
      };

      this.ws.onclose = () => {
        this.callbacks.onDisconnect?.();
        if (this.shouldReconnect) {
          this.reconnectTimeout = setTimeout(() => {
            this.connect(sessionId, language);
          }, 3000);
        }
      };

      this.ws.onerror = () => {
        this.callbacks.onError?.("connection_error", "WebSocket connection error");
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "WebSocket initialization failed";
      this.callbacks.onError?.("connection_error", msg);
    }
  }

  private handleTextMessage(msg: WsServerMessage): void {
    switch (msg.type) {
      case "ready":
        this.callbacks.onReady?.(msg.session_id, msg.voice);
        break;
      case "transcript":
        this.callbacks.onTranscript?.(msg.text, msg.language);
        break;
      case "sentence":
        this.callbacks.onSentence?.(msg.index, msg.text, msg.source);
        break;
      case "done":
        this.callbacks.onDone?.(msg.source, msg.metrics);
        break;
      case "no_speech":
        this.callbacks.onNoSpeech?.();
        break;
      case "interrupted":
        this.callbacks.onInterrupted?.();
        break;
      case "error":
        this.callbacks.onError?.(msg.code, msg.message);
        break;
    }
  }

  sendUtterance(pcmData: Int16Array | Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const frame = encodeUtteranceFrame(pcmData);
      this.ws.send(frame);
    }
  }

  sendInterrupt(): void {
    this.sendMessage({ type: "interrupt" });
  }

  sendMessage(msg: WsClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }
}
