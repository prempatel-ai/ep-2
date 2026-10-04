/**
 * Wire protocol types mirroring backend/README.md and OpenAPI schemas.
 * Type-only definitions; zero runtime logic.
 */

export type LanguageCode = "gu" | "hi" | "en";

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  native_name: string;
}

export interface AudioConfig {
  input_sample_rate: number;
  input_format: "pcm_s16le_mono";
  max_utterance_s: number;
}

export interface ServerConfig {
  languages: LanguageInfo[];
  default_language: LanguageCode;
  voice: boolean;
  audio: AudioConfig;
}

export interface ReadinessResponse {
  ready: boolean;
  llm: boolean;
  faq_entries: number;
  voice: boolean;
}

export interface HealthResponse {
  status: "ok";
  version: string;
}

export type AnswerSource = "safety" | "faq" | "model";

export interface TurnMetrics {
  stt_ms: number | null;
  first_sentence_ms: number | null;
  first_audio_ms: number | null;
  total_ms: number;
}

// ---------------------------------------------------------------------------
// HTTP Chat (SSE) Types - POST /v1/chat
// ---------------------------------------------------------------------------

export interface ChatRequest {
  text: string;
  session_id?: string;
  language?: LanguageCode;
}

export interface SessionEvent {
  type: "session";
  session_id: string;
}

export interface SentenceEvent {
  type: "sentence";
  index: number;
  text: string;
  source: AnswerSource;
}

export interface DoneEvent {
  type: "done";
  source: AnswerSource | null;
  metrics: TurnMetrics;
}

export interface ErrorEvent {
  type: "error";
  code:
    | "invalid_request"
    | "invalid_audio"
    | "voice_unavailable"
    | "llm_unavailable"
    | "stt_failed"
    | "tts_failed"
    | "server_error";
  message: string;
}

export type ChatStreamEvent = SessionEvent | SentenceEvent | DoneEvent | ErrorEvent;

// ---------------------------------------------------------------------------
// WebSocket Voice Types - WS /v1/voice
// ---------------------------------------------------------------------------

// Client -> Server
export interface WsStartMessage {
  type: "start";
  session_id?: string;
  language?: LanguageCode | null;
}

export interface WsTextMessage {
  type: "text";
  text: string;
  speak: boolean;
  turn?: number;
}

export interface WsInterruptMessage {
  type: "interrupt";
}

export type WsClientMessage = WsStartMessage | WsTextMessage | WsInterruptMessage;

// Server -> Client
export interface WsReadyMessage {
  type: "ready";
  session_id: string;
  voice: boolean;
  input_sample_rate: number;
}

export interface WsTranscriptMessage {
  type: "transcript";
  text: string;
  language: LanguageCode;
  turn?: number;
}

export interface WsSentenceMessage {
  type: "sentence";
  index: number;
  text: string;
  source: AnswerSource;
  turn?: number;
}

export interface WsDoneMessage {
  type: "done";
  source: AnswerSource | null;
  metrics: TurnMetrics;
  turn?: number;
}

export interface WsNoSpeechMessage {
  type: "no_speech";
  turn?: number;
}

export interface WsInterruptedMessage {
  type: "interrupted";
  turn?: number;
}

export interface WsErrorMessage {
  type: "error";
  code: string;
  message: string;
  turn?: number;
}

export type WsServerMessage =
  | WsReadyMessage
  | WsTranscriptMessage
  | WsSentenceMessage
  | WsDoneMessage
  | WsNoSpeechMessage
  | WsInterruptedMessage
  | WsErrorMessage;
