import React, { useReducer, useState, useRef, useEffect, useCallback } from "react";
import { AlertCircle } from "lucide-react";
import type { LanguageCode, AnswerSource } from "@/api/types";
import { chat, deleteSession, getReady } from "@/api/http";
import type { SavedConversation } from "@/features/history/types";
import {
  generateConversationTitle,
  sanitizeMessagesForStorage,
} from "@/features/history/storage";
import {
  conversationReducer,
  initialConversationState,
} from "./conversationReducer";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { ContextRail } from "./ContextRail";
import styles from "./ChatView.module.css";

interface ChatViewProps {
  currentLanguage: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  onNewConversation?: () => void;
  onSwitchToVoice?: () => void;
  activeConversation?: SavedConversation | null;
  onSaveConversation?: (conv: SavedConversation) => void;
  initialPrompt?: string;
}

export function ChatView({
  currentLanguage,
  onSwitchToVoice,
  activeConversation,
  onSaveConversation,
  initialPrompt,
}: ChatViewProps) {
  const [state, dispatch] = useReducer(conversationReducer, {
    ...initialConversationState,
    sessionId: activeConversation?.sessionId ?? null,
    messages: activeConversation?.messages ?? [],
  });
  const convIdRef = useRef<string>(activeConversation?.id ?? "");
  const createdAtRef = useRef<number>(activeConversation?.createdAt ?? 0);
  const titleRef = useRef<string>(activeConversation?.title ?? "");
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const [showNewResponse, setShowNewResponse] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const prevMsgCountRef = useRef<number>(0);
  const prevLatestLengthRef = useRef<number>(0);
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

  // Persist conversation updates safely
  useEffect(() => {
    const validMessages = sanitizeMessagesForStorage(state.messages);
    const firstUserMsg = validMessages.find((m) => m.role === "user");

    if (firstUserMsg && onSaveConversation) {
      if (!convIdRef.current) {
        convIdRef.current = `conv_${Date.now()}`;
      }
      if (!createdAtRef.current) {
        createdAtRef.current = Date.now();
      }

      const title =
        titleRef.current || generateConversationTitle(firstUserMsg.text);
      titleRef.current = title;

      onSaveConversation({
        id: convIdRef.current,
        title,
        createdAt: createdAtRef.current,
        updatedAt: Date.now(),
        language: currentLanguage,
        sessionId: state.sessionId,
        messages: validMessages,
      });
    }
  }, [state.messages, state.sessionId, currentLanguage, onSaveConversation]);

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

    setShowNewResponse(false);

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

  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  useEffect(() => {
    if (initialPrompt && state.messages.length === 0) {
      const timer = setTimeout(() => {
        void handleSendRef.current(initialPrompt);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [initialPrompt, state.messages.length]);

  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = state.sessionId;
  }, [state.sessionId]);

  useEffect(() => {
    return () => {
      handleStop();
      if (sessionIdRef.current) {
        void deleteSession(sessionIdRef.current).catch(() => {});
      }
    };
  }, []);

  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNear = distanceFromBottom < 80;
    isNearBottomRef.current = isNear;
    if (isNear) {
      setShowNewResponse(false);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = scrollAreaRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowNewResponse(false);
    isNearBottomRef.current = true;
  };

  // When messages change, handle scroll without interrupting if user is reading older messages
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;

    const currentCount = state.messages.length;
    const latestMsg = state.messages[currentCount - 1];
    const currentLen = latestMsg?.text?.length || 0;

    const countChanged = currentCount !== prevMsgCountRef.current;
    const lenChanged = currentLen !== prevLatestLengthRef.current;
    prevMsgCountRef.current = currentCount;
    prevLatestLengthRef.current = currentLen;

    if (!countChanged && !lenChanged) return;

    // If new user message just sent, immediately scroll to bottom
    if (latestMsg?.role === "user") {
      isNearBottomRef.current = true;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      return;
    }

    // If assistant is responding / streaming
    if (isNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      // User scrolled up to read older messages; do not aggressively yank down
      if (latestMsg?.role === "assistant") {
        requestAnimationFrame(() => {
          setShowNewResponse(true);
        });
      }
    }
  }, [state.messages]);

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

      {/* Main Content Workspace */}
      <div className={styles.contentWorkspace}>
        {/* Center Conversation Column */}
        <div className={styles.chatColumn}>
          {/* Scrollable message viewport */}
          <div
            ref={scrollAreaRef}
            className={styles.messageScrollArea}
            onScroll={handleScroll}
          >
            <div className={styles.messagesInner}>
              <MessageList
                messages={state.messages}
                onSelectPrompt={(prompt) => handleSend(prompt)}
              />
            </div>
          </div>

          {/* Floating "↓ New response" button if user scrolled up */}
          {showNewResponse && (
            <button
              type="button"
              className={styles.newResponseButton}
              onClick={() => scrollToBottom("smooth")}
              aria-label="Scroll to new response"
            >
              <span>↓ New response</span>
            </button>
          )}

          {/* Sticky Composer Container */}
          <div className={styles.composerContainer}>
            <div className={styles.composerInner}>
              <Composer
                isSubmitting={state.isSubmitting}
                onSend={handleSend}
                onStop={handleStop}
                onSwitchToVoice={onSwitchToVoice}
                disabled={serverReady === false}
              />
            </div>
          </div>
        </div>

        {/* Quiet Context Rail */}
        <ContextRail
          latestMessage={[...state.messages].reverse().find((m) => m.role === "assistant")}
          currentLanguage={currentLanguage}
          isOnline={serverReady !== false}
        />
      </div>
    </div>
  );
}
