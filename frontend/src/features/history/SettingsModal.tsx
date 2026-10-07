"use client";

import React, { useEffect } from "react";
import { Settings, X } from "lucide-react";
import type { LanguageCode } from "@/api/types";
import styles from "./SettingsModal.module.css";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  conversationsCount: number;
  onClearAllData: () => void;
  isOnline?: boolean;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentLanguage,
  onLanguageChange,
  conversationsCount,
  onClearAllData,
  isOnline = true,
}: SettingsModalProps) {
  const [hangoverMs, setHangoverMs] = React.useState<number>(() => {
    if (typeof localStorage !== "undefined") {
      const h = Number(localStorage.getItem("sahayak_vad_hangover_ms"));
      if (!Number.isNaN(h) && h > 0) return h;
    }
    return 800;
  });

  const [minSpeechMs, setMinSpeechMs] = React.useState<number>(() => {
    if (typeof localStorage !== "undefined") {
      const m = Number(localStorage.getItem("sahayak_vad_min_speech_ms"));
      if (!Number.isNaN(m) && m > 0) return m;
    }
    return 250;
  });

  const handleHangoverChange = (val: number) => {
    setHangoverMs(val);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("sahayak_vad_hangover_ms", String(val));
    }
  };

  const handleMinSpeechChange = (val: number) => {
    setMinSpeechMs(val);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("sahayak_vad_min_speech_ms", String(val));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Settings">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <Settings size={18} className={styles.titleIcon} aria-hidden="true" />
            <h2 className={styles.title}>Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close settings"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.content}>
          {/* Section 1: Language */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Language & Voice</span>
            <div className={styles.settingRow}>
              <div className={styles.settingLabelGroup}>
                <span className={styles.settingLabel}>Response Language</span>
                <span className={styles.settingDescription}>
                  Clinical information and voice will be rendered in this language.
                </span>
              </div>
              <select
                value={currentLanguage}
                onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                className={styles.selectInput}
                aria-label="Response Language"
              >
                <option value="en">English</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>
          </div>

          {/* Section 1b: Voice Activity Detection (VAD) */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Voice Activity Detection (VAD)</span>
            <div className={styles.settingRow}>
              <div className={styles.settingLabelGroup}>
                <span className={styles.settingLabel}>Silence Hangover</span>
                <span className={styles.settingDescription}>
                  Grace period before ending turn. Prevents cutting off mid-sentence pauses.
                </span>
              </div>
              <select
                value={hangoverMs}
                onChange={(e) => handleHangoverChange(Number(e.target.value))}
                className={styles.selectInput}
                aria-label="Silence Hangover"
              >
                <option value={500}>500 ms (Fast)</option>
                <option value={800}>800 ms (Default)</option>
                <option value={1000}>1000 ms (Patient)</option>
                <option value={1200}>1200 ms (Extended)</option>
              </select>
            </div>
            <div className={styles.settingRow}>
              <div className={styles.settingLabelGroup}>
                <span className={styles.settingLabel}>Barge-in Speech Guard</span>
                <span className={styles.settingDescription}>
                  Minimum speech duration required before interrupting assistant playback.
                </span>
              </div>
              <select
                value={minSpeechMs}
                onChange={(e) => handleMinSpeechChange(Number(e.target.value))}
                className={styles.selectInput}
                aria-label="Barge-in Speech Guard"
              >
                <option value={150}>150 ms (Sensitive)</option>
                <option value={250}>250 ms (Default: rejects coughs)</option>
                <option value={350}>350 ms (Strict)</option>
                <option value={500}>500 ms (Very Strict)</option>
              </select>
            </div>
          </div>

          {/* Section 2: Storage & Privacy */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Local Storage & Privacy</span>
            <div className={styles.settingRow}>
              <div className={styles.settingLabelGroup}>
                <span className={styles.settingLabel}>Local Device History</span>
                <span className={styles.settingDescription}>
                  {conversationsCount} conversation{conversationsCount === 1 ? "" : "s"} stored locally on this browser.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Clear all local conversations and saved answers from this device?")) {
                    onClearAllData();
                    onClose();
                  }
                }}
                className={styles.clearDataButton}
              >
                Clear data
              </button>
            </div>
          </div>

          {/* Section 3: Clinical System */}
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Medical Model State</span>
            <div className={styles.settingRow}>
              <div className={styles.settingLabelGroup}>
                <span className={styles.settingLabel}>Inference Engine</span>
                <span className={styles.settingDescription}>
                  Offline on-device inference with rule-based oncology guideline match.
                </span>
              </div>
              <span className={styles.statusBadge}>
                <span className={styles.statusDot} />
                {isOnline ? "Connected" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
