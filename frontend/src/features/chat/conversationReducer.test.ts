import { describe, it, expect } from "vitest";
import {
  conversationReducer,
  initialConversationState,
  type ConversationState,
} from "./conversationReducer";

describe("conversationReducer", () => {
  it("handles SEND_USER_MESSAGE by adding user and placeholder assistant message", () => {
    const next = conversationReducer(initialConversationState, {
      type: "SEND_USER_MESSAGE",
      id: "u-1",
      text: "What are the early signs?",
      assistantId: "a-1",
      timestamp: 1000,
    });

    expect(next.messages).toHaveLength(2);
    expect(next.messages[0]).toEqual({
      id: "u-1",
      role: "user",
      text: "What are the early signs?",
      state: "complete",
      timestamp: 1000,
    });
    expect(next.messages[1]).toEqual({
      id: "a-1",
      role: "assistant",
      text: "",
      state: "streaming",
      sentences: [],
      timestamp: 1001,
    });
    expect(next.isSubmitting).toBe(true);
    expect(next.activeAssistantMessageId).toBe("a-1");
  });

  it("handles APPEND_SENTENCE progressively appending sentences", () => {
    const s1: ConversationState = {
      sessionId: "s-1",
      messages: [
        {
          id: "a-1",
          role: "assistant",
          text: "",
          state: "streaming",
          sentences: [],
          timestamp: 1000,
        },
      ],
      isSubmitting: true,
      activeAssistantMessageId: "a-1",
      error: null,
    };

    const s2 = conversationReducer(s1, {
      type: "APPEND_SENTENCE",
      assistantId: "a-1",
      sentence: { index: 0, text: "First sentence.", source: "faq" },
    });

    expect(s2.messages[0].text).toBe("First sentence.");
    expect(s2.messages[0].source).toBe("faq");
    expect(s2.messages[0].sentences).toHaveLength(1);

    const s3 = conversationReducer(s2, {
      type: "APPEND_SENTENCE",
      assistantId: "a-1",
      sentence: { index: 1, text: "Second sentence.", source: "faq" },
    });

    expect(s3.messages[0].text).toBe("First sentence. Second sentence.");
    expect(s3.messages[0].sentences).toHaveLength(2);
  });

  it("handles COMPLETE_MESSAGE transitioning state to complete", () => {
    const s1: ConversationState = {
      sessionId: "s-1",
      messages: [
        {
          id: "a-1",
          role: "assistant",
          text: "Answer text.",
          state: "streaming",
          sentences: [{ index: 0, text: "Answer text.", source: "model" }],
          timestamp: 1000,
        },
      ],
      isSubmitting: true,
      activeAssistantMessageId: "a-1",
      error: null,
    };

    const s2 = conversationReducer(s1, {
      type: "COMPLETE_MESSAGE",
      assistantId: "a-1",
      source: "model",
      metrics: { stt_ms: null, first_sentence_ms: 120, first_audio_ms: null, total_ms: 300 },
    });

    expect(s2.isSubmitting).toBe(false);
    expect(s2.activeAssistantMessageId).toBeNull();
    expect(s2.messages[0].state).toBe("complete");
    expect(s2.messages[0].metrics?.total_ms).toBe(300);
  });

  it("handles STOP_MESSAGE transitioning state to stopped", () => {
    const s1: ConversationState = {
      sessionId: "s-1",
      messages: [
        {
          id: "a-1",
          role: "assistant",
          text: "Partial text",
          state: "streaming",
          sentences: [],
          timestamp: 1000,
        },
      ],
      isSubmitting: true,
      activeAssistantMessageId: "a-1",
      error: null,
    };

    const s2 = conversationReducer(s1, {
      type: "STOP_MESSAGE",
      assistantId: "a-1",
    });

    expect(s2.isSubmitting).toBe(false);
    expect(s2.activeAssistantMessageId).toBeNull();
    expect(s2.messages[0].state).toBe("stopped");
  });

  it("handles FAIL_MESSAGE transitioning state to failed with error", () => {
    const s1: ConversationState = {
      sessionId: "s-1",
      messages: [
        {
          id: "a-1",
          role: "assistant",
          text: "",
          state: "streaming",
          sentences: [],
          timestamp: 1000,
        },
      ],
      isSubmitting: true,
      activeAssistantMessageId: "a-1",
      error: null,
    };

    const s2 = conversationReducer(s1, {
      type: "FAIL_MESSAGE",
      assistantId: "a-1",
      error: "LLM backend unavailable",
    });

    expect(s2.isSubmitting).toBe(false);
    expect(s2.error).toBe("LLM backend unavailable");
    expect(s2.messages[0].state).toBe("failed");
    expect(s2.messages[0].error).toBe("LLM backend unavailable");
  });

  it("handles CLEAR_CONVERSATION reset", () => {
    const s1: ConversationState = {
      sessionId: "s-1",
      messages: [
        {
          id: "u-1",
          role: "user",
          text: "Hi",
          state: "complete",
          timestamp: 1,
        },
      ],
      isSubmitting: false,
      activeAssistantMessageId: null,
      error: null,
    };

    const s2 = conversationReducer(s1, { type: "CLEAR_CONVERSATION" });
    expect(s2).toEqual(initialConversationState);
  });
});
