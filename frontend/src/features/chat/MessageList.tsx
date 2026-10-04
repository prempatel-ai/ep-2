import React, { useRef, useEffect, useState } from "react";
import { AlertCircle, Bookmark, Copy, Check } from "lucide-react";
import type { ChatMessageItem } from "./conversationReducer";
import { SourceBadge } from "./SourceBadge";
import { ClinicalContent } from "./ClinicalContent";
import {
  saveAnswer,
  removeSavedAnswer,
  isAnswerSaved,
} from "@/features/history/savedAnswersStorage";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: ChatMessageItem[];
  onSelectPrompt?: (prompt: string) => void;
}

export function MessageList({
  messages,
  onSelectPrompt,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const set = new Set<string>();
    messages.forEach((m) => {
      if (m.role === "assistant" && isAnswerSaved(m.id)) {
        set.add(m.id);
      }
    });
    return set;
  });

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore
    }
  };

  const handleToggleSave = (message: ChatMessageItem, index: number) => {
    const isCurrentlySaved = savedIds.has(message.id);
    if (isCurrentlySaved) {
      removeSavedAnswer(message.id);
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    } else {
      const prevUser = [...messages.slice(0, index)]
        .reverse()
        .find((m) => m.role === "user");
      saveAnswer({
        id: message.id,
        question: prevUser?.text || "Clinical inquiry",
        text: message.text || "",
        source: message.source,
      });
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.add(message.id);
        return next;
      });
    }
  };

  useEffect(() => {
    if (messages.length > 0 && typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div
      className={styles.container}
      role="region"
      aria-label="Clinical Conversation History"
    >
      <h2 className={styles.srOnly}>Conversation Message History</h2>

      {messages.length === 0 ? (
        <div className={styles.welcomeWorkspace}>
          {/* LEFT COLUMN: Clear introductory text */}
          <div className={styles.welcomeIntro}>
            <h3 className={styles.welcomeTitle}>
              Breast cancer information, explained clearly.
            </h3>
            <p className={styles.welcomeDesc}>
              Sahayak provides evidence-based medical information to help
              patients and families understand breast health, screenings, and
              clinical decisions.
            </p>

            <div className={styles.evidenceSection}>
              <span className={styles.evidenceLabel}>Evidence-based information about:</span>
              <ul className={styles.evidenceList}>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot}>•</span>
                  <span>Symptoms</span>
                </li>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot}>•</span>
                  <span>Screening</span>
                </li>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot}>•</span>
                  <span>Diagnosis</span>
                </li>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot}>•</span>
                  <span>Staging</span>
                </li>
                <li className={styles.evidenceItem}>
                  <span className={styles.bulletDot}>•</span>
                  <span>Treatment</span>
                </li>
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN: Common medical questions list */}
          <div className={styles.suggestionsContainer}>
            <span className={styles.suggestionsLabel}>Common Questions</span>
            <div className={styles.suggestionsList} role="group" aria-label="Suggested Medical Questions">
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
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isSaved = savedIds.has(message.id);
            return (
              <div
                key={message.id}
                className={`${styles.turnBlock} ${
                  isUser ? styles.turnUser : styles.turnAssistant
                }`}
                data-testid={`message-${message.role}`}
              >
                {!isUser && (
                  <div className={styles.turnHeader}>
                    <span className={styles.senderRole}>Sahayak</span>
                    {message.source && (
                      <SourceBadge source={message.source} />
                    )}
                    {message.state === "stopped" && (
                      <span className={styles.stoppedTag}>Generation stopped</span>
                    )}
                  </div>
                )}

                <div
                  className={`${styles.turnBody} ${
                    isUser ? styles.bodyUser : styles.bodyAssistant
                  }`}
                >
                  {isUser ? (
                    <p className={styles.userText}>{message.text}</p>
                  ) : message.text ? (
                    <ClinicalContent content={message.text} />
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

                {/* Response Action Row (Only for assistant responses with text) */}
                {!isUser && message.text && message.state !== "streaming" && (
                  <div className={styles.actionRow}>
                    <button
                      type="button"
                      onClick={() => handleCopy(message.id, message.text || "")}
                      className={styles.actionBtn}
                      aria-label={copiedId === message.id ? "Copied to clipboard" : "Copy response"}
                      title="Copy response"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check size={13} className={styles.actionIconSuccess} aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} className={styles.actionIcon} aria-hidden="true" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSave(message, index)}
                      className={`${styles.actionBtn} ${isSaved ? styles.actionBtnSaved : ""}`}
                      aria-label={isSaved ? "Saved to bookmarked answers" : "Save answer"}
                      title={isSaved ? "Saved" : "Save"}
                    >
                      <Bookmark
                        size={13}
                        className={isSaved ? styles.actionIconSaved : styles.actionIcon}
                        fill={isSaved ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
                      <span>{isSaved ? "Saved" : "Save"}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
