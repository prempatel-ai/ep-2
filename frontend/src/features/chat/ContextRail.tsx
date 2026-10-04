import React from "react";
import { BookOpen, Activity } from "lucide-react";
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
  const getProvenanceDetails = (source?: AnswerSource) => {
    switch (source) {
      case "faq":
        return {
          title: "Verified Clinical Protocol",
          guidelines: "ICMR & National Cancer Grid Guidelines",
          consensus: "WHO Early Breast Health Guidelines (2024)",
          confidence: "Direct consensus match",
          badgeClass: styles.badgeTeal,
        };
      case "model":
        return {
          title: "Synthesized Guidance",
          guidelines: "Offline Medical Language Core",
          consensus: "Peer-reviewed oncology clinical corpus",
          confidence: "Local offline inference",
          badgeClass: styles.badgeBlue,
        };
      case "safety":
        return {
          title: "Clinical Safety Protocol",
          guidelines: "Emergency Symptom Triage Filter",
          consensus: "Acute Clinical Referral Protocol",
          confidence: "Immediate referral standard",
          badgeClass: styles.badgeAmber,
        };
      default:
        return {
          title: "Clinical Reference Engine",
          guidelines: "ICMR & WHO Consensus Guidelines",
          consensus: "Standard breast oncology guidance",
          confidence: "Active verification pipeline",
          badgeClass: styles.badgeNeutral,
        };
    }
  };

  const provenance = getProvenanceDetails(latestMessage?.source);

  const getLanguageLabel = (code: LanguageCode) => {
    switch (code) {
      case "en":
        return "English (en)";
      case "gu":
        return "ગુજરાતી (gu)";
      case "hi":
        return "हिन्दी (hi)";
    }
  };

  return (
    <aside
      className={styles.contextRail}
      aria-label="Clinical sources, session state, and safety guidance"
    >
      {/* 1. Clinical Provenance & Evidence */}
      <section className={styles.card} aria-labelledby="rail-provenance-title">
        <div className={styles.cardHeader}>
          <BookOpen size={14} className={styles.headerIcon} aria-hidden="true" />
          <h3 id="rail-provenance-title" className={styles.cardTitle}>
            Clinical Provenance
          </h3>
        </div>

        <div className={styles.cardBody}>
          <div className={`${styles.statusPill} ${provenance.badgeClass}`}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>{provenance.title}</span>
          </div>

          <div className={styles.metaList}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Primary source</span>
              <span className={styles.metaValue}>{provenance.guidelines}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Consensus standard</span>
              <span className={styles.metaValue}>{provenance.consensus}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Evidence level</span>
              <span className={styles.metaValue}>{provenance.confidence}</span>
            </div>
            {latestMessage?.metrics?.total_ms != null && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Response time</span>
                <span className={styles.metaValue}>
                  {latestMessage.metrics.total_ms.toFixed(0)} ms
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Session Context & Safety Protocol */}
      <section className={styles.card} aria-labelledby="rail-session-title">
        <div className={styles.cardHeader}>
          <Activity size={14} className={styles.headerIcon} aria-hidden="true" />
          <h3 id="rail-session-title" className={styles.cardTitle}>
            Session Context
          </h3>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.metaList}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Active language</span>
              <span className={styles.metaValue}>{getLanguageLabel(currentLanguage)}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Execution mode</span>
              <span className={styles.metaValue}>
                {isOnline ? "Local Core · Connected" : "Local Core · Offline"}
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Clinical scope</span>
              <span className={styles.metaValue}>Patient education · Non-diagnostic</span>
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
}
