import React from "react";
import type { LanguageCode, AnswerSource } from "@/api/types";
import type { ChatMessageItem } from "./conversationReducer";
import styles from "./ContextRail.module.css";

interface ContextRailProps {
  latestMessage?: ChatMessageItem;
  currentLanguage: LanguageCode;
  isOnline?: boolean;
}

export function ContextRail({
  latestMessage,
  currentLanguage,
  isOnline = true,
}: ContextRailProps) {
  const getProvenanceSource = (source?: AnswerSource) => {
    switch (source) {
      case "faq":
        return {
          title: "Verified Clinical FAQ",
          engine: "Rule-based guideline match",
        };
      case "model":
        return {
          title: "Local Medical Model",
          engine: "Offline on-device inference",
        };
      case "safety":
        return {
          title: "Clinical Safety Protocol",
          engine: "Emergency symptom triage filter",
        };
      default:
        return {
          title: "Local Medical Model",
          engine: "Offline on-device inference",
        };
    }
  };

  const provenance = getProvenanceSource(latestMessage?.source);

  const getLanguageLabel = (code: LanguageCode) => {
    switch (code) {
      case "en":
        return "English";
      case "gu":
        return "ગુજરાતી (Gujarati)";
      case "hi":
        return "हिन्दी (Hindi)";
    }
  };

  return (
    <aside
      className={styles.contextRail}
      aria-label="Clinical session and provenance context"
    >
      <div className={styles.railContainer}>
        {/* Section 1: Clinical Provenance */}
        <div className={styles.section}>
          <span className={styles.sectionHeader}>Clinical Provenance</span>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Source</span>
            <span className={styles.metaValue}>{provenance.title}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Engine</span>
            <span className={styles.metaValue}>{provenance.engine}</span>
          </div>
          {latestMessage?.metrics?.total_ms != null && (
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Response time</span>
              <span className={styles.metaValue}>
                {Math.round(latestMessage.metrics.total_ms)} ms
              </span>
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* Section 2: Session Context (Real session data) */}
        <div className={styles.section}>
          <span className={styles.sectionHeader}>Session</span>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Language</span>
            <span className={styles.metaValue}>{getLanguageLabel(currentLanguage)}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Mode</span>
            <span className={styles.metaValue}>
              {isOnline ? "Local · Connected" : "Local · Offline"}
            </span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Scope</span>
            <span className={styles.metaValue}>Non-diagnostic</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
