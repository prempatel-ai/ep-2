import { describe, it, expect } from "vitest";
import { parseSseStream } from "./sse";

function createMockStream(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });
  return stream.getReader();
}

describe("parseSseStream", () => {
  it("parses single and multiple standard SSE data events", async () => {
    const chunks = [
      'data: {"type":"session","session_id":"sess-123"}\n\n',
      'data: {"type":"sentence","index":0,"text":"Hello world.","source":"model"}\n\n',
      'data: {"type":"done","source":"model","metrics":{"stt_ms":null,"first_sentence_ms":100,"first_audio_ms":null,"total_ms":200}}\n\n',
    ];
    const reader = createMockStream(chunks);
    const events = [];
    for await (const event of parseSseStream(reader)) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: "session", session_id: "sess-123" });
    expect(events[1]).toEqual({
      type: "sentence",
      index: 0,
      text: "Hello world.",
      source: "model",
    });
    expect(events[2].type).toBe("done");
  });

  it("handles chunk boundaries split inside events and json payloads", async () => {
    const chunks = [
      'data: {"type":"sent',
      'ence","index":0,"te',
      'xt":"Split chunk text.","source":"faq"}\n',
      '\n',
    ];
    const reader = createMockStream(chunks);
    const events = [];
    for await (const event of parseSseStream(reader)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "sentence",
      index: 0,
      text: "Split chunk text.",
      source: "faq",
    });
  });

  it("handles multi-byte unicode characters properly across chunks", async () => {
    const chunks = [
      'data: {"type":"sentence","index":0,"text":"આ સ્તનના કેન્સર અંગે માહિતી છે.","source":"safety"}\n\n',
    ];
    const reader = createMockStream(chunks);
    const events = [];
    for await (const event of parseSseStream(reader)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect((events[0] as { text?: string }).text).toBe("આ સ્તનના કેન્સર અંગે માહિતી છે.");
  });

  it("ignores SSE comments and non-JSON data gracefully", async () => {
    const chunks = [
      ": keep-alive heartbeat\n",
      "data: not-a-json-object\n\n",
      'data: {"type":"session","session_id":"s1"}\n\n',
    ];
    const reader = createMockStream(chunks);
    const events = [];
    for await (const event of parseSseStream(reader)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "session", session_id: "s1" });
  });
});
