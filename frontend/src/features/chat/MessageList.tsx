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
    <div className={styles.container} role="region" aria-label="Clinical conversation workspace">
      {/* Assistive technology polite announcements for incoming streamed sentences */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="false"
        className={styles.srOnly}
      >
        {latestSentence}
      </div>

      {messages.length === 0 ? (
        <div className={styles.welcomeWorkspace}>
          <div className={styles.welcomeIntro}>
            <span className={styles.clinicalContextTag}>Verified Clinical Knowledge Base</span>
            <h2 className={styles.welcomeTitle}>
              {emptyPromptText || "Breast Cancer Information Assistant"}
            </h2>
            <p className={styles.welcomeDesc}>
              Sahayak provides verified guidance on clinical symptoms, screening guidelines,
              staging, and diagnosis queries in Gujarati, Hindi, and English.
            </p>
          </div>

          <div className={styles.suggestedSection}>
            <span className={styles.suggestedLabel}>Common clinical inquiries</span>
            <div className={styles.suggestedList} role="list">
              <button
                type="button"
                role="listitem"
                className={styles.suggestedRow}
                onClick={() =>
                  onSelectPrompt?.("What are the most common early signs of breast cancer?")
                }
              >
                <div className={styles.rowContent}>
                  <span className={styles.rowText}>
                    What are the most common early signs of breast cancer?
                  </span>
                  <span className={styles.rowTopic}>Early Detection & Symptoms</span>
                </div>
                <span className={styles.rowArrow} aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                role="listitem"
                className={styles.suggestedRow}
                onClick={() =>
                  onSelectPrompt?.("How often should women get a mammogram screening?")
                }
              >
                <div className={styles.rowContent}>
                  <span className={styles.rowText}>
                    How often should women get a mammogram screening?
                  </span>
                  <span className={styles.rowTopic}>Screening & Mammography</span>
                </div>
                <span className={styles.rowArrow} aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                role="listitem"
                className={styles.suggestedRow}
                onClick={() =>
                  onSelectPrompt?.("Is every breast lump cancerous?")
                }
              >
                <div className={styles.rowContent}>
                  <span className={styles.rowText}>
                    Is every breast lump cancerous?
                  </span>
                  <span className={styles.rowTopic}>Lump Assessment & Biopsy</span>
                </div>
                <span className={styles.rowArrow} aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                role="listitem"
                className={styles.suggestedRow}
                onClick={() =>
                  onSelectPrompt?.("What are the standard stages of breast cancer?")
                }
              >
                <div className={styles.rowContent}>
                  <span className={styles.rowText}>
                    What are the standard stages of breast cancer?
                  </span>
                  <span className={styles.rowTopic}>Staging & Diagnosis</span>
                </div>
                <span className={styles.rowArrow} aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.conversationStream}>
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={`${styles.turnBlock} ${
                  isUser ? styles.turnUser : styles.turnAssistant
                }`}
                data-testid={`message-${message.role}`}
              >
                <div className={styles.turnHeader}>
                  <span className={styles.senderRole}>
                    {isUser ? "Query" : "Clinical Guidance"}
                  </span>
                  {!isUser && message.source && (
                    <SourceBadge source={message.source} />
                  )}
                  {message.state === "stopped" && (
                    <span className={styles.stoppedTag}>Generation stopped</span>
                  )}
                </div>

                <div
                  className={`${styles.turnBody} ${
                    isUser ? styles.bodyUser : styles.bodyAssistant
                  }`}
                >
                  {message.text ? (
                    <p className={styles.textContent}>{message.text}</p>
                  ) : message.state === "streaming" ? (
                    <div className={styles.processingIndicator} aria-label="Retrieving verified answer...">
                      <span className={styles.pulseDot} />
                      <span className={styles.pulseDot} />
                      <span className={styles.pulseDot} />
                      <span className={styles.loadingText}>Synthesizing clinical response...</span>
                    </div>
                  ) : null}

                  {message.state === "failed" && (
                    <div className={styles.errorNotice} role="alert">
                      <span className={styles.errorIcon}>⚠️</span>
                      <span>{message.error || "Unable to retrieve clinical answer."}</span>
                    </div>
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
