import React, { useState } from "react";
import {
  AlertCircle,
  Bookmark,
  Copy,
  Check,
  ShieldCheck,
  Activity,
  Calendar,
  FileText,
  Layers,
  Pill,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import type { ChatMessageItem } from "./conversationReducer";
import { SourceBadge } from "./SourceBadge";
import { ClinicalContent } from "./ClinicalContent";
import { useTypewriter } from "./useTypewriter";
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

function AssistantStreamingContent({
  text,
  isStreaming,
}: {
  text: string;
  isStreaming: boolean;
}) {
  const animatedText = useTypewriter(text, isStreaming);
  return <ClinicalContent content={animatedText} isStreaming={isStreaming} />;
}

export function MessageList({
  messages,
  onSelectPrompt,
}: MessageListProps) {
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

  return (
    <div
      className={styles.container}
      role="region"
      aria-label="Clinical Conversation History"
    >
      <h2 className={styles.srOnly}>Conversation Message History</h2>

      {messages.length === 0 ? (
        <div className={styles.welcomeWorkspace}>
          {/* Hero Introductory Section */}
          <div className={styles.welcomeHero}>
            <div className={styles.heroBadge}>
              <ShieldCheck size={14} className={styles.heroBadgeIcon} aria-hidden="true" />
              <span>Evidence-based clinical guidance</span>
            </div>

            <h3 className={styles.welcomeTitle}>
              Breast cancer information, explained clearly.
            </h3>

            <p className={styles.welcomeDesc}>
              Sahayak provides verified clinical guidance to help patients, caregivers,
              and families understand symptoms, screening schedules, and clinical decisions.
            </p>

            {/* Quick Topic Chips */}
            <div className={styles.topicPills} role="group" aria-label="Browse clinical topics">
              {[
                { label: "Symptoms", icon: Activity, query: "What are the common symptoms of breast cancer?" },
                { label: "Screening", icon: Calendar, query: "How often should women get screened for breast cancer?" },
                { label: "Diagnosis", icon: FileText, query: "What are the common diagnostic steps for breast cancer?" },
                { label: "Staging", icon: Layers, query: "How is breast cancer staged?" },
                { label: "Treatment", icon: Pill, query: "What are standard treatment approaches for breast cancer?" },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className={styles.topicPill}
                  onClick={() => onSelectPrompt?.(t.query)}
                  aria-label={`Ask about ${t.label}`}
                >
                  <t.icon size={13} className={styles.pillIcon} aria-hidden="true" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Suggested Clinical Question Cards */}
          <div className={styles.suggestionsContainer}>
            <div className={styles.suggestionsHeader}>
              <Sparkles size={14} className={styles.suggestionsIcon} aria-hidden="true" />
              <span className={styles.suggestionsLabel}>Frequently Asked Clinical Questions</span>
            </div>

            <div className={styles.cardsGrid}>
              {[
                {
                  id: "q1",
                  topic: "Early signs",
                  title: "What are early warning signs of breast cancer?",
                },
                {
                  id: "q2",
                  topic: "Screening guideline",
                  title: "How often should women aged 40-49 get screened?",
                },
                {
                  id: "q3",
                  topic: "Diagnostic steps",
                  title: "What is the difference between a mammogram and ultrasound?",
                },
                {
                  id: "q4",
                  topic: "When to seek care",
                  title: "When should someone seek immediate clinical care?",
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.questionCard}
                  onClick={() => onSelectPrompt?.(item.title)}
                  aria-label={`Ask: ${item.title}`}
                >
                  <div className={styles.cardTopRow}>
                    <span className={styles.cardTopicBadge}>{item.topic}</span>
                    <ArrowUpRight size={14} className={styles.cardArrow} aria-hidden="true" />
                  </div>
                  <span className={styles.cardTitle}>{item.title}</span>
                </button>
              ))}
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
                className={`${styles.message} ${
                  isUser ? styles.userMessage : styles.assistantMessage
                }`}
                data-testid={`message-${message.role}`}
              >
                {!isUser && (
                  <div className={styles.messageHeader}>
                    <span className={styles.senderRole}>Sahayak</span>
                    {message.source && (
                      <SourceBadge source={message.source} />
                    )}
                    {message.state === "stopped" && (
                      <span className={styles.stoppedTag}>Generation stopped</span>
                    )}
                  </div>
                )}

                {isUser ? (
                  <div className={styles.userBubble}>
                    <p className={styles.userText}>{message.text}</p>
                  </div>
                ) : (
                  <div className={styles.messageContent}>
                    {message.text ? (
                      <AssistantStreamingContent
                        text={message.text}
                        isStreaming={message.state === "streaming"}
                      />
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
                )}

                {/* Response Action Row (strictly encapsulated in assistant message) */}
                {!isUser && message.text && message.state !== "streaming" && (
                  <div className={styles.messageActions}>
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
    </div>
  );
}
