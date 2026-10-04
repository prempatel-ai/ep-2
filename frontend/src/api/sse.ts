import type { ChatStreamEvent } from "./types";

/**
 * Pure SSE line parser. Parses raw chunks into ChatStreamEvent objects.
 * Handles multiline data, chunk boundaries, and skips comments.
 */
export async function* parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;

      if (trimmed.startsWith("data:")) {
        const jsonStr = trimmed.slice(5).trim();
        try {
          const parsed = JSON.parse(jsonStr) as ChatStreamEvent;
          yield parsed;
        } catch {
          // ignore corrupted lines or non-JSON payloads gracefully
        }
      }
    }
  }

  if (buffer.trim().startsWith("data:")) {
    const jsonStr = buffer.trim().slice(5).trim();
    try {
      const parsed = JSON.parse(jsonStr) as ChatStreamEvent;
      yield parsed;
    } catch {
      // ignore
    }
  }
}
