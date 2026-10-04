import React, { useReducer, useState, useRef, useEffect, useCallback } from "react";
import type { LanguageCode, AnswerSource } from "@/api/types";
import { chat, deleteSession, getReady } from "@/api/http";
import {
  conversationReducer,
  initialConversationState,
} from "./conversationReducer";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import styles from "./ChatView.module.css";

interface ChatViewProps {
  currentLanguage: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  onNewConversation?: () => void;
  onSwitchToVoice?: () => void;
}

export function ChatView({
  currentLanguage,
  onSwitchToVoice,
}: ChatViewProps) {
  const [state, dispatch] = useReducer(conversationReducer, initialConversationState);
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check backend readiness on load and poll occasionally
  const checkReadiness = useCallback(async () => {
    try {
      const readyData = await getReady();
      setServerReady(readyData.ready);
      setLlmReady(readyData.llm);
      if (!readyData.ready) {
        dispatch({
          type: "SET_GLOBAL_ERROR",
          error: "The medical assistant engine is initializing. Please wait a moment...",
        });
      } else {
        dispatch({ type: "SET_GLOBAL_ERROR", error: null });
      }
    } catch {
      setServerReady(false);
      setLlmReady(false);
      dispatch({
        type: "SET_GLOBAL_ERROR",
        error: "Backend server is currently unreachable. Make sure the local server is running.",
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const poll = async () => {
      if (!isMounted) return;
      await checkReadiness();
    };

    void poll();
    const interval = setInterval(() => {
      void poll();
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [checkReadiness]);

  const handleSend = async (text: string) => {
    if (state.isSubmitting) return;

    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now()}`;

    dispatch({
      type: "SEND_USER_MESSAGE",
      id: userMsgId,
      text,
      assistantId: assistantMsgId,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const stream = chat(
        {
          text,
          session_id: state.sessionId || undefined,
          language: currentLanguage,
        },
        controller.signal,
      );

      let finalSource: AnswerSource | null = null;

      for await (const event of stream) {
        if (event.type === "session") {
          dispatch({ type: "SET_SESSION", sessionId: event.session_id });
        } else if (event.type === "sentence") {
          finalSource = event.source;
          dispatch({
            type: "APPEND_SENTENCE",
            assistantId: assistantMsgId,
            sentence: {
              index: event.index,
              text: event.text,
              source: event.source,
            },
          });
        } else if (event.type === "done") {
          dispatch({
            type: "COMPLETE_MESSAGE",
            assistantId: assistantMsgId,
            source: event.source ?? finalSource,
            metrics: event.metrics,
          });
        } else if (event.type === "error") {
          dispatch({
            type: "FAIL_MESSAGE",
            assistantId: assistantMsgId,
            error: event.message,
          });
        }
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        dispatch({ type: "STOP_MESSAGE", assistantId: assistantMsgId });
      } else {
        const errorMsg =
          err instanceof Error ? err.message : "Connection interrupted or server error";
        dispatch({
          type: "FAIL_MESSAGE",
          assistantId: assistantMsgId,
          error: errorMsg,
        });
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleNewConversation = async () => {
    handleStop();
    if (state.sessionId) {
      try {
        await deleteSession(state.sessionId);
      } catch {
        // ignore deletion cleanup failure
      }
    }
    dispatch({ type: "CLEAR_CONVERSATION" });
    checkReadiness();
  };

  return (
    <div className={styles.chatView}>
      {/* Top Banner for Server / LLM offline or degraded status */}
      {state.error && (
        <div className={styles.warningBanner} role="alert">
          <span className={styles.warningIcon} aria-hidden="true">⚠️</span>
          <span>{state.error}</span>
          <button
            type="button"
            className={styles.retryButton}
            onClick={checkReadiness}
          >
            Retry
          </button>
        </div>
      )}

      {serverReady === true && llmReady === false && (
        <div className={styles.infoBanner} role="status">
          <span>
            Notice: Offline LLM generation is unavailable. Direct verified FAQ answers and safety protocols remain fully operational.
          </span>
        </div>
      )}

      <div className={styles.toolbar}>
        {onSwitchToVoice && (
          <button
            type="button"
            onClick={onSwitchToVoice}
            className={styles.voiceModeButton}
            aria-label="Start voice conversation with interactive globe"
          >
            <span className={styles.micIcon} aria-hidden="true">🎙️</span>
            <span>Voice Mode</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleNewConversation}
          className={styles.newChatButton}
          aria-label="Clear chat and start new conversation"
        >
          <span className={styles.resetIcon} aria-hidden="true">↺</span>
          <span>New conversation</span>
        </button>
      </div>

      <div className={styles.messageRegion}>
        <MessageList
          messages={state.messages}
          onSelectPrompt={(prompt) => handleSend(prompt)}
        />
      </div>

      <div className={styles.composerRegion}>
        <Composer
          isSubmitting={state.isSubmitting}
          onSend={handleSend}
          onStop={handleStop}
          disabled={serverReady === false}
        />
      </div>
    </div>
  );
}
