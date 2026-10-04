import { useEffect, type ReactNode } from "react";
import { Mic, PanelLeft } from "lucide-react";
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
  sidebar?: ReactNode;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  activeConversationTitle?: string | null;
}

export function AppShell({
  children,
  currentLanguage = "en",
  onLanguageChange,
  isOnline = true,
  onSwitchToVoice,
  activeMode = "text",
  sidebar,
  isSidebarOpen = true,
  onToggleSidebar,
  activeConversationTitle,
}: AppShellProps) {
  const t = getTranslation(currentLanguage);

  // Synchronize document root lang attribute for assistive technology and font matching
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = currentLanguage;
    }
  }, [currentLanguage]);

  return (
    <div className={styles.appLayout}>
      {/* Persistent History Sidebar */}
      {sidebar}

      {/* Main App Workspace */}
      <div className={styles.container}>
        {/* Top Header - Compact healthcare product toolbar (56px) */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            {/* LEFT: Sidebar Toggle (when collapsed/mobile) & Conversation Title */}
            <div className={styles.leftGroup}>
              {onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className={`${styles.sidebarToggleButton} ${
                    isSidebarOpen ? styles.sidebarToggleWhenOpen : ""
                  }`}
                  aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                  title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                  <PanelLeft size={16} aria-hidden="true" />
                </button>
              )}

              {/* Accessible Document Heading for Screen Readers & Test Suites */}
              <h1 className={styles.srOnly}>{t.app.title}</h1>

              {/* Contextual Conversation Title (Only when present) */}
              {activeConversationTitle ? (
                <span className={styles.conversationTitle} title={activeConversationTitle}>
                  {activeConversationTitle}
                </span>
              ) : null}
            </div>

            {/* RIGHT: Connected status, Language, Voice Mode */}
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

              {/* 3. Voice Mode Action */}
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
    </div>
  );
}
