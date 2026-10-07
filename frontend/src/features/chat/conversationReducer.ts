import type { AnswerSource, TurnMetrics } from "@/api/types";

export type MessageState = "streaming" | "complete" | "failed" | "stopped";

export interface SentenceItem {
  index: number;
  text: string;
  source: AnswerSource;
}

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  state: MessageState;
  source?: AnswerSource;
  sentences?: SentenceItem[];
  metrics?: TurnMetrics;
  error?: string;
  timestamp: number;
}

export interface ConversationState {
  sessionId: string | null;
  messages: ChatMessageItem[];
  isSubmitting: boolean;
  activeAssistantMessageId: string | null;
  error: string | null;
}

export type ConversationAction =
  | { type: "SEND_USER_MESSAGE"; id: string; text: string; assistantId: string; timestamp?: number }
  | { type: "SET_SESSION"; sessionId: string }
  | { type: "APPEND_SENTENCE"; assistantId: string; sentence: SentenceItem }
  | { type: "COMPLETE_MESSAGE"; assistantId: string; source: AnswerSource | null; metrics?: TurnMetrics }
  | { type: "FAIL_MESSAGE"; assistantId: string; error: string }
  | { type: "STOP_MESSAGE"; assistantId: string }
  | { type: "CLEAR_CONVERSATION" }
  | { type: "LOAD_CONVERSATION"; sessionId: string | null; messages: ChatMessageItem[] }
  | { type: "SET_GLOBAL_ERROR"; error: string | null };

export const initialConversationState: ConversationState = {
  sessionId: null,
  messages: [],
  isSubmitting: false,
  activeAssistantMessageId: null,
  error: null,
};

/**
 * Intelligently joins progressive sentence items while preserving markdown headings,
 * bullet lists, numbered points, and verified source citations without collapsing
 * everything into a single run-on paragraph.
 */
export function joinSentences(sentences: string[]): string {
  if (sentences.length === 0) return "";
  let result = "";

  for (let i = 0; i < sentences.length; i++) {
    const raw = sentences[i];
    const text = raw.trim();
    if (!text) continue;

    if (result.length === 0) {
      result = text;
      continue;
    }

    const prev = result.trimEnd();
    const isHeading = /^#{1,6}\s+/.test(text);
    const isBullet = /^[•*-]\s+/.test(text);
    const isNumber = /^\d+\.\s+/.test(text);
    const isSource = /^Sources?:\s*/i.test(text);

    if (isHeading || isSource) {
      // Strip any dangling incomplete bullet stubs right before sources
      const cleanedPrev = isSource
        ? prev.replace(/(?:\r?\n)?^[•*-]\s*(?:Myth:?|Fact:?)?$/im, "").trimEnd()
        : prev;
      result = `${cleanedPrev}\n\n${text}`;
    } else if (isBullet || isNumber) {
      // Check if the previous line was also a list item
      const lastLine = prev.slice(prev.lastIndexOf("\n") + 1);
      const prevWasList = /^[•*-]\s+/.test(lastLine) || /^\d+\.\s+/.test(lastLine);
      result = prevWasList ? `${prev}\n${text}` : `${prev}\n\n${text}`;
    } else {
      if (prev.endsWith("\n")) {
        result = `${prev}${text}`;
      } else {
        result = `${prev} ${text}`;
      }
    }
  }

  return result.trim();
}

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case "SEND_USER_MESSAGE": {
      const userMsg: ChatMessageItem = {
        id: action.id,
        role: "user",
        text: action.text,
        state: "complete",
        timestamp: action.timestamp ?? Date.now(),
      };
      const assistantMsg: ChatMessageItem = {
        id: action.assistantId,
        role: "assistant",
        text: "",
        state: "streaming",
        sentences: [],
        timestamp: (action.timestamp ?? Date.now()) + 1,
      };
      return {
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isSubmitting: true,
        activeAssistantMessageId: action.assistantId,
        error: null,
      };
    }

    case "SET_SESSION": {
      return {
        ...state,
        sessionId: action.sessionId,
      };
    }

    case "APPEND_SENTENCE": {
      return {
        ...state,
        messages: state.messages.map((msg) => {
          if (msg.id !== action.assistantId) return msg;
          const currentSentences = msg.sentences || [];
          const updatedSentences = [...currentSentences, action.sentence];
          const newText = joinSentences(updatedSentences.map((s) => s.text));
          return {
            ...msg,
            sentences: updatedSentences,
            text: newText,
            source: action.sentence.source,
          };
        }),
      };
    }

    case "COMPLETE_MESSAGE": {
      return {
        ...state,
        isSubmitting: false,
        activeAssistantMessageId: null,
        messages: state.messages.map((msg) => {
          if (msg.id !== action.assistantId) return msg;
          return {
            ...msg,
            state: "complete",
            source: action.source ?? msg.source,
            metrics: action.metrics,
          };
        }),
      };
    }

    case "FAIL_MESSAGE": {
      return {
        ...state,
        isSubmitting: false,
        activeAssistantMessageId: null,
        error: action.error,
        messages: state.messages.map((msg) => {
          if (msg.id !== action.assistantId) return msg;
          return {
            ...msg,
            state: "failed",
            error: action.error,
          };
        }),
      };
    }

    case "STOP_MESSAGE": {
      return {
        ...state,
        isSubmitting: false,
        activeAssistantMessageId: null,
        messages: state.messages.map((msg) => {
          if (msg.id !== action.assistantId) return msg;
          return {
            ...msg,
            state: "stopped",
          };
        }),
      };
    }

    case "CLEAR_CONVERSATION": {
      return {
        ...initialConversationState,
      };
    }

    case "LOAD_CONVERSATION": {
      return {
        sessionId: action.sessionId,
        messages: action.messages,
        isSubmitting: false,
        activeAssistantMessageId: null,
        error: null,
      };
    }

    case "SET_GLOBAL_ERROR": {
      return {
        ...state,
        error: action.error,
      };
    }

    default:
      return state;
  }
}
