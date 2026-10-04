import React, { useReducer, useState, useRef, useEffect, useCallback } from "react";
import { AlertCircle } from "lucide-react";
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

  const checkReadiness = useCallback(async () => {
    try {
      const readyData = await getReady();
      setServerReady(readyData.ready);
      setLlmReady(readyData.llm);
      if (!readyData.ready) {
        dispatch({
          type: "SET_GLOBAL_ERROR",
          error: "The clinical assistant engine is initializing. Please wait...",
        });
      } else {
        dispatch({ type: "SET_GLOBAL_ERROR", error: null });
      }
    } catch {
      setServerReady(false);
      setLlmReady(false);
      dispatch({
        type: "SET_GLOBAL_ERROR",
        error: "Backend server is offline or unreachable.",
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

  useEffect(() => {
    return () => {
      handleStop();
      if (state.sessionId) {
        void deleteSession(state.sessionId).catch(() => {});
      }
    };
  }, [state.sessionId]);

  const hasMessages = state.messages.length > 0;

  return (
    <div
      className={`${styles.chatWorkspace} ${
        hasMessages ? styles.inConversation : styles.inEmptyState
      }`}
    >
      {/* Systematic Status / Offline Banners */}
      {state.error && (
        <div className={styles.warningBanner} role="alert">
          <div className={styles.warningMain}>
            <AlertCircle size={15} className={styles.alertIcon} aria-hidden="true" />
            <span className={styles.bannerText}>{state.error}</span>
          </div>
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
          Verified FAQ direct answering active. Offline language model currently unavailable.
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className={styles.messagesContainer}>
        <MessageList
          messages={state.messages}
          onSelectPrompt={(prompt) => handleSend(prompt)}
        />
      </div>

      {/* Primary Interaction Composer */}
      <div className={styles.composerContainer}>
        <Composer
          isSubmitting={state.isSubmitting}
          onSend={handleSend}
          onStop={handleStop}
          onSwitchToVoice={onSwitchToVoice}
          disabled={serverReady === false}
        />
      </div>
    </div>
  );
}
