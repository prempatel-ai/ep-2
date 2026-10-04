import React from "react";
import type { TurnMetrics } from "@/api/types";
import styles from "./DevPanel.module.css";

interface DevPanelProps {
  metrics: TurnMetrics | null;
  currentTurn: number;
  isOpen: boolean;
  onToggle: () => void;
}

export function DevPanel({ metrics, currentTurn, isOpen, onToggle }: DevPanelProps) {
  return (
    <div className={styles.container}>
      <button
        type="button"
        className={styles.toggleButton}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className={styles.tag}>DEV</span>
        <span>Metrics {isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className={styles.metricsBox}>
          <div className={styles.row}>
            <span className={styles.label}>Turn:</span>
            <span className={styles.value}>#{currentTurn}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>STT Latency:</span>
            <span className={styles.value}>
              {metrics?.stt_ms != null ? `${metrics.stt_ms.toFixed(0)} ms` : "n/a"}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>1st Sentence:</span>
            <span className={styles.value}>
              {metrics?.first_sentence_ms != null
                ? `${metrics.first_sentence_ms.toFixed(0)} ms`
                : "n/a"}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>1st Audio:</span>
            <span className={styles.value}>
              {metrics?.first_audio_ms != null
                ? `${metrics.first_audio_ms.toFixed(0)} ms`
                : "n/a"}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Total:</span>
            <span className={styles.value}>
              {metrics?.total_ms != null ? `${metrics.total_ms.toFixed(0)} ms` : "n/a"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
