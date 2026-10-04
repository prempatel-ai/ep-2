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
    if (messages.length > 0 && typeof bottomRef.current?.scrollIntoView === "function") {
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
            <h2 className={styles.welcomeTitle}>
              {emptyPromptText || "Breast cancer information, explained clearly."}
            </h2>
            <p className={styles.welcomeDesc}>
              Sahayak provides evidence-based medical information to help patients and families understand breast health, screenings, and clinical decisions.
            </p>
            <div className={styles.evidenceSection}>
              <span className={styles.evidenceLabel}>Evidence-based information about:</span>
              <ul className={styles.evidenceList}>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot} aria-hidden="true">•</span>
                  <span>Symptoms</span>
                </li>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot} aria-hidden="true">•</span>
                  <span>Screening</span>
                </li>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot} aria-hidden="true">•</span>
                  <span>Diagnosis</span>
                </li>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot} aria-hidden="true">•</span>
                  <span>Staging</span>
                </li>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot} aria-hidden="true">•</span>
                  <span>Treatment</span>
                </li>
              </ul>
            </div>
          </div>

          <div className={styles.suggestionsContainer}>
            <span className={styles.suggestionsLabel}>Common questions</span>
            <div className={styles.suggestionsList}>
              <button
                type="button"
                className={styles.questionRow}
                onClick={() =>
                  onSelectPrompt?.("What are the early signs of breast cancer?")
                }
              >
                <span className={styles.questionText}>What are the early signs of breast cancer?</span>
                <span className={styles.questionArrow} aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className={styles.questionRow}
                onClick={() =>
                  onSelectPrompt?.("How often should women get a mammogram?")
                }
              >
                <span className={styles.questionText}>How often should women get a mammogram?</span>
                <span className={styles.questionArrow} aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className={styles.questionRow}
                onClick={() =>
                  onSelectPrompt?.("Is every breast lump cancerous?")
                }
              >
                <span className={styles.questionText}>Is every breast lump cancerous?</span>
                <span className={styles.questionArrow} aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className={styles.questionRow}
                onClick={() =>
                  onSelectPrompt?.("What are the standard stages of breast cancer?")
                }
              >
                <span className={styles.questionText}>What are the standard stages of breast cancer?</span>
                <span className={styles.questionArrow} aria-hidden="true">→</span>
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
                    {isUser ? "You" : "Sahayak"}
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
