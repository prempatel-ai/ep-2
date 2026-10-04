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
