import { useEffect, type ReactNode } from "react";
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
          <div className={styles.brand}>
            {/* Minimal geometric medical mark: clean, flat teal emblem */}
            <div className={styles.brandSymbol} aria-hidden="true">
              <svg
                width="16"
                height="16"
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

          <div className={styles.headerActions}>
            {/* System connectivity status */}
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

            {/* Voice Mode primary utility button */}
            {onSwitchToVoice && activeMode === "text" && (
              <button
                type="button"
                onClick={onSwitchToVoice}
                className={styles.voiceModeButton}
                aria-label="Switch to interactive voice mode"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                <span>Voice Mode</span>
              </button>
            )}

            {/* Language Selector */}
            <div className={styles.languageControl}>
              <LanguageSelector
                currentLanguage={currentLanguage}
                onLanguageChange={onLanguageChange}
              />
            </div>

            {/* New Conversation secondary action */}
            {onNewConversation && (
              <button
                type="button"
                onClick={onNewConversation}
                className={styles.newChatButton}
                aria-label="Start new conversation"
              >
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
