import { useState, useEffect, type ReactNode } from "react";
import { Mic, PanelLeft, Activity, Camera } from "lucide-react";
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
  activeMode?: "text" | "voice" | "image";
  sidebar?: ReactNode;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  activeConversationTitle?: string | null;
  onOpenClinicalDetails?: () => void;
  imageCheckEnabled?: boolean;
  onSwitchToImageCheck?: () => void;
  onSwitchToTextChat?: () => void;
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
  onOpenClinicalDetails,
  imageCheckEnabled = false,
  onSwitchToImageCheck,
  onSwitchToTextChat,
}: AppShellProps) {
  const t = getTranslation(currentLanguage);
  const [showEmergency, setShowEmergency] = useState(false);

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
        {/* Top Header - Compact healthcare product toolbar (56–60px) */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            {/* LEFT: Sidebar Toggle & Brand Title (Mobile) or Conversation Title (Desktop) */}
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

              {/* Document Heading & Mobile Brand Title */}
              <h1 className={styles.mobileBrandTitle}>{t.app.title}</h1>

              {/* Desktop / Tablet Contextual Conversation Title */}
              {activeConversationTitle ? (
                <span
                  className={styles.conversationTitle}
                  title={activeConversationTitle}
                  suppressHydrationWarning
                >
                  {activeConversationTitle}
                </span>
              ) : null}
            </div>

            {/* RIGHT: Status, Language, Details, Voice */}
            <div className={styles.headerRightGroup}>
              {/* 1. Connected status (Desktop & Tablet only) */}
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

              {/* 2. Language Selector (Desktop & Tablet only) */}
              <div className={styles.languageControl}>
                <LanguageSelector
                  currentLanguage={currentLanguage}
                  onLanguageChange={onLanguageChange}
                />
              </div>

              {/* 3. Clinical Details Action: Single right action on mobile, optional on tablet */}
              {onOpenClinicalDetails && (
                <button
                  type="button"
                  onClick={onOpenClinicalDetails}
                  className={styles.detailsButton}
                  aria-label="View clinical details and provenance"
                  title="Clinical details"
                >
                  <Activity size={16} className={styles.detailsButtonIcon} aria-hidden="true" />
                  <span className={styles.detailsButtonText}>Details</span>
                </button>
              )}

              {/* 4. Image Check Action (Hidden when backend reports feature off) */}
              {imageCheckEnabled && onSwitchToImageCheck && activeMode !== "image" && (
                <button
                  type="button"
                  onClick={onSwitchToImageCheck}
                  className={styles.imageCheckButton}
                  aria-label="Open image check tool"
                >
                  <Camera size={14} className={styles.imageCheckButtonIcon} aria-hidden="true" />
                  <span>
                    {t.imageCheck.navButton && t.imageCheck.navButton !== "[NEEDS HUMAN TRANSLATION]"
                      ? t.imageCheck.navButton
                      : "Image check"}
                  </span>
                </button>
              )}

              {/* Back to Chat Action when in Image Check Mode */}
              {activeMode === "image" && onSwitchToTextChat && (
                <button
                  type="button"
                  onClick={onSwitchToTextChat}
                  className={styles.imageCheckButton}
                  aria-label="Return to chat"
                >
                  <span>Chat</span>
                </button>
              )}

              {/* 5. Voice Mode Action (Desktop & Tablet only) */}
              {onSwitchToVoice && activeMode === "text" && (
                <button
                  type="button"
                  onClick={onSwitchToVoice}
                  className={styles.voiceButton}
                  aria-label="Switch to interactive voice mode"
                >
                  <Mic size={14} className={styles.voiceButtonIcon} aria-hidden="true" />
                  <span className={styles.voiceButtonText}>Voice</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Conversation Canvas */}
        <main className={styles.main}>
          <div className={styles.mainContent}>{children}</div>
        </main>

        {/* Clinical Safety Notice Footer */}
        <footer className={styles.footer}>
          {/* Desktop full disclaimer */}
          <div className={styles.desktopFooterContent}>
            <p className={styles.disclaimerText}>
              {t.disclaimer.notice}
            </p>
            <p className={styles.emergencyText}>
              If you are experiencing severe pain, urgent symptoms, or a medical crisis, please contact Indian government helplines immediately:{" "}
              <span className={styles.emergencyNumber}>112 (National Emergency)</span>,{" "}
              <span className={styles.emergencyNumber}>108 (Free Ambulance)</span>,{" "}
              <span className={styles.emergencyNumber}>104 (Health Helpline)</span>, or{" "}
              <span className={styles.emergencyNumber}>14416 (Tele-MANAS Mental Health)</span>.
            </p>
          </div>

          {/* Mobile compact disclaimer with expandable emergency info */}
          <div className={styles.mobileFooterContent}>
            <div className={styles.mobileDisclaimerRow}>
              <span className={styles.mobileDisclaimerCompact}>
                Clinical information only · Not medical advice
              </span>
              <button
                type="button"
                onClick={() => setShowEmergency((prev) => !prev)}
                className={styles.emergencyToggleButton}
                aria-expanded={showEmergency}
              >
                Emergency information
              </button>
            </div>
            {showEmergency && (
              <p className={styles.mobileEmergencyExpanded} role="region" aria-label="Emergency contact information">
                If you are experiencing urgent symptoms or distress, contact Indian emergency helplines:{" "}
                <span className={styles.emergencyNumber}>112 (Emergency)</span>,{" "}
                <span className={styles.emergencyNumber}>108 (Ambulance)</span>,{" "}
                <span className={styles.emergencyNumber}>104 (Health)</span>, or{" "}
                <span className={styles.emergencyNumber}>14416 (Tele-MANAS)</span>.
              </p>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
