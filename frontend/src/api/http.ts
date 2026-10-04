import type { ServerConfig, ReadinessResponse, HealthResponse } from "./types";

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
