import React, { useRef, useEffect } from "react";
import { AlertCircle } from "lucide-react";
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
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
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
            <div className={styles.welcomeBadge}>
              <span className={styles.pulseTeal} />
              <span>Verified Clinical Knowledge</span>
            </div>
            <h2 className={styles.welcomeTitle}>
              {emptyPromptText || "What breast cancer questions can I help with?"}
            </h2>
            <p className={styles.welcomeDesc}>
              Sahayak is an offline clinical assistant providing verified guidance on symptoms,
              screening guidelines, diagnosis, and staging queries in Gujarati, Hindi, and English.
            </p>
          </div>

          <div className={styles.suggestedGrid}>
            <button
              type="button"
              className={styles.suggestedCard}
              onClick={() =>
                onSelectPrompt?.("What are the most common early signs of breast cancer?")
              }
            >
              <span className={styles.cardPrompt}>What are early signs of breast cancer?</span>
            </button>

            <button
              type="button"
              className={styles.suggestedCard}
              onClick={() =>
                onSelectPrompt?.("How often should women get a mammogram screening?")
              }
            >
              <span className={styles.cardPrompt}>How often should women get a mammogram?</span>
            </button>

            <button
              type="button"
              className={styles.suggestedCard}
              onClick={() =>
                onSelectPrompt?.("Is every breast lump cancerous?")
              }
            >
              <span className={styles.cardPrompt}>Is every breast lump cancerous?</span>
            </button>

            <button
              type="button"
              className={styles.suggestedCard}
              onClick={() =>
                onSelectPrompt?.("What are the standard stages of breast cancer?")
              }
            >
              <span className={styles.cardPrompt}>What are the standard stages of breast cancer?</span>
            </button>
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
                    {isUser ? "Inquiry" : "Clinical Guidance"}
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
                      <AlertCircle size={15} className={styles.errorIcon} aria-hidden="true" />
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
