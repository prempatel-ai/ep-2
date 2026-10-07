import React from "react";
import type { TurnMetrics } from "@/api/types";
import styles from "./DevPanel.module.css";

export interface CaptureJitterInfo {
  avgJitterMs: number;
  maxJitterMs: number;
}

interface DevPanelProps {
  metrics: TurnMetrics | null;
  currentTurn: number;
  isOpen: boolean;
  onToggle: () => void;
  captureJitter?: CaptureJitterInfo | null;
  playbackUnderruns?: number;
  vadHangoverMs?: number;
  vadMinSpeechMs?: number;
}

export function DevPanel({
  metrics,
  currentTurn,
  isOpen,
  onToggle,
  captureJitter,
  playbackUnderruns,
  vadHangoverMs = 800,
  vadMinSpeechMs = 250,
}: DevPanelProps) {
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
          <div className={styles.row}>
            <span className={styles.label}>Capture Jitter:</span>
            <span className={styles.value}>
              {captureJitter != null && captureJitter.maxJitterMs > 0
                ? `${captureJitter.avgJitterMs.toFixed(1)} ms (max ${captureJitter.maxJitterMs.toFixed(1)} ms)`
                : "0.0 ms"}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Underruns:</span>
            <span className={styles.value}>
              {playbackUnderruns != null ? `${playbackUnderruns}` : "0"}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>VAD Engine:</span>
            <span className={styles.value}>Silero v5 (Worklet)</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>VAD Hangover:</span>
            <span className={styles.value}>{vadHangoverMs} ms</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Barge-in Min:</span>
            <span className={styles.value}>{vadMinSpeechMs} ms</span>
          </div>
        </div>
      )}
    </div>
  );
}
