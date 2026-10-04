import React, { useRef, useEffect } from "react";
import type { ChatMessageItem } from "./conversationReducer";
import { SourceBadge } from "./SourceBadge";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: ChatMessageItem[];
  emptyPromptText?: string;
  onSelectPrompt?: (prompt: string) => void;
}

export function MessageList({
  messages,
  emptyPromptText,
  onSelectPrompt,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const latestSentence =
    latestAssistant?.sentences && latestAssistant.sentences.length > 0
      ? latestAssistant.sentences[latestAssistant.sentences.length - 1].text
      : null;

  return (
    <div className={styles.container} role="region" aria-label="Conversation messages">
      {/* Politely announced live region for incoming sentences */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="false"
        className={styles.srOnly}
      >
        {latestSentence}
      </div>

      {messages.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyCard}>
            <span className={styles.badgeCardHeader}>Verified Clinical Knowledge Base</span>
            <h2 className={styles.emptyTitle}>
              {emptyPromptText || "Breast Cancer Questions & Guidance"}
            </h2>
            <p className={styles.emptyDesc}>
              Sahayak is an offline clinical assistant providing verified guidance on symptoms,
              screening guidelines, diagnosis, and treatment queries.
            </p>
            <div className={styles.sampleQueries}>
              <span className={styles.sampleQueriesLabel}>Suggested verified topics:</span>
              <div className={styles.chipList}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() =>
                    onSelectPrompt?.("What are the most common early signs of breast cancer?")
                  }
                >
                  <span>What are the most common early signs of breast cancer?</span>
                  <span className={styles.chipArrow} aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() =>
                    onSelectPrompt?.("How often should women get a mammogram screening?")
                  }
                >
                  <span>How often should women get a mammogram screening?</span>
                  <span className={styles.chipArrow} aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() =>
                    onSelectPrompt?.("Is every breast lump cancerous?")
                  }
                >
                  <span>Is every breast lump cancerous?</span>
                  <span className={styles.chipArrow} aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.messageList}>
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={`${styles.messageRow} ${
                  isUser ? styles.rowUser : styles.rowAssistant
                }`}
                data-testid={`message-${message.role}`}
              >
                <div className={styles.messageMeta}>
                  <span className={styles.roleLabel}>
                    {isUser ? "You" : "Sahayak"}
                  </span>
                  {!isUser && message.source && (
                    <SourceBadge source={message.source} />
                  )}
                  {message.state === "stopped" && (
                    <span className={styles.stoppedTag}>Stopped</span>
                  )}
                </div>

                <div
                  className={`${styles.bubble} ${
                    isUser ? styles.bubbleUser : styles.bubbleAssistant
                  }`}
                >
                  {message.text ? (
                    <p className={styles.messageText}>{message.text}</p>
                  ) : message.state === "streaming" ? (
                    <div className={styles.streamingIndicator} aria-label="Thinking...">
                      <span className={styles.pulseDot} />
                      <span className={styles.pulseDot} />
                      <span className={styles.pulseDot} />
                    </div>
                  ) : null}

                  {message.state === "failed" && (
                    <p className={styles.errorMessage}>
                      {message.error || "Failed to generate response."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
