import type {
  ServerConfig,
  ReadinessResponse,
  HealthResponse,
  ChatRequest,
  ChatStreamEvent,
} from "./types";
import { parseSseStream } from "./sse";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with HTTP ${res.status}`);
  }
  return res.json();
}

export async function getReady(): Promise<ReadinessResponse> {
  const res = await fetch(`${API_BASE}/ready`);
  return res.json();
}

export async function getConfig(): Promise<ServerConfig> {
  const res = await fetch(`${API_BASE}/v1/config`);
  if (!res.ok) {
    throw new Error(`Config fetch failed with HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete session failed with HTTP ${res.status}`);
  }
}

export async function* chat(
  request: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const res = await fetch(`${API_BASE}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok) {
    let errorMessage = `Server error HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) {
        errorMessage = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  if (!res.body) {
    throw new Error("Response body is not readable");
  }

  const reader = res.body.getReader();
  yield* parseSseStream(reader);
}
