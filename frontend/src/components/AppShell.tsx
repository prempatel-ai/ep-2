import { useEffect, type ReactNode } from "react";
import { Mic, Plus } from "lucide-react";
import styles from "./AppShell.module.css";
import type { LanguageCode } from "@/api/types";
import { getTranslation } from "@/i18n";
import { LanguageSelector } from "./LanguageSelector";

interface AppShellProps {
  children?: ReactNode;
  currentLanguage?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  isOnline?: boolean;
  onSwitchToVoice?: () => void;
  onNewConversation?: () => void;
  activeMode?: "text" | "voice";
}

export function AppShell({
  children,
  currentLanguage = "en",
  onLanguageChange,
  isOnline = true,
  onSwitchToVoice,
  onNewConversation,
  activeMode = "text",
}: AppShellProps) {
  const t = getTranslation(currentLanguage);

  // Synchronize document root lang attribute for assistive technology and font matching
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage]);

  return (
    <div className={styles.container}>
      {/* Top Header - Professional healthcare product toolbar */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          {/* LEFT: Sahayak identity */}
          <div className={styles.brand}>
            {/* Minimal geometric medical mark: clean, flat teal emblem */}
            <div className={styles.brandSymbol} aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="8" y="2" width="4" height="16" rx="2" fill="#0d9488" />
                <rect x="2" y="8" width="16" height="4" rx="2" fill="#0d9488" />
              </svg>
            </div>
            <div className={styles.brandInfo}>
              <h1 className={styles.title}>{t.app.title}</h1>
              <p className={styles.subtitle}>{t.app.subtitle}</p>
            </div>
          </div>

          {/* RIGHT: Cohesive system status & user actions */}
          <div className={styles.headerRightGroup}>
            {/* 1. Connected status */}
            <div
              className={styles.statusIndicator}
              role="status"
              aria-label={isOnline ? t.header.statusOnline : t.header.statusOffline}
            >
              <span
                className={isOnline ? styles.statusDotOnline : styles.statusDotOffline}
                aria-hidden="true"
              />
              <span className={styles.statusText}>
                {isOnline ? t.header.statusOnline : t.header.statusOffline}
              </span>
            </div>

            {/* 2. Language Selector */}
            <div className={styles.languageControl}>
              <LanguageSelector
                currentLanguage={currentLanguage}
                onLanguageChange={onLanguageChange}
              />
            </div>

            {/* 3. Voice Mode primary action */}
            {onSwitchToVoice && activeMode === "text" && (
              <button
                type="button"
                onClick={onSwitchToVoice}
                className={styles.voiceButton}
                aria-label="Switch to interactive voice mode"
              >
                <Mic size={14} className={styles.voiceButtonIcon} aria-hidden="true" />
                <span>Voice</span>
              </button>
            )}

            {/* 4. New Conversation secondary action */}
            {onNewConversation && (
              <button
                type="button"
                onClick={onNewConversation}
                className={styles.newChatButton}
                aria-label="Start new conversation"
              >
                <Plus size={14} className={styles.newChatIcon} aria-hidden="true" />
                <span>{t.header.newConversation}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Conversation Canvas */}
      <main className={styles.main}>
        <div className={styles.mainContent}>{children}</div>
      </main>

      {/* Restrained Clinical Safety Notice Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p className={styles.disclaimerText}>
            {t.disclaimer.notice}
          </p>
          <p className={styles.emergencyText}>
            If you are experiencing severe pain, urgent symptoms, or a medical emergency, please contact local emergency services immediately:{" "}
            <span className={styles.emergencyNumber}>112 (National Emergency)</span> or{" "}
            <span className={styles.emergencyNumber}>14416 (Tele-MANAS)</span>.
          </p>
        </div>
      </footer>
    </div>
  );
}
