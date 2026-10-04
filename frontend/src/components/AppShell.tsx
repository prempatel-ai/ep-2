import type { ReactNode } from "react";
import styles from "./AppShell.module.css";
import type { LanguageCode } from "@/api/types";
import { getTranslation } from "@/i18n";
import { LanguageSelector } from "./LanguageSelector";

interface AppShellProps {
  children?: ReactNode;
  currentLanguage?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  isOnline?: boolean;
}

export function AppShell({
  children,
  currentLanguage = "en",
  onLanguageChange,
  isOnline = true,
}: AppShellProps) {
  const t = getTranslation(currentLanguage);

  return (
    <div className={styles.container}>
      {/* Top Header - Restrained, modern healthcare enterprise software */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <span className={styles.brandSymbol} aria-hidden="true">
              +
            </span>
            <div className={styles.brandInfo}>
              <div className={styles.brandTitleRow}>
                <h1 className={styles.title}>{t.app.title}</h1>
                <span className={styles.statusOfflineTag}>Offline Core</span>
              </div>
              <p className={styles.subtitle}>{t.app.subtitle}</p>
            </div>
          </div>

          <div className={styles.headerActions}>
            {/* Understated connection status indicator */}
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

            {/* Language Selector Dropdown Menu */}
            <div className={styles.languageControl}>
              <LanguageSelector
                currentLanguage={currentLanguage}
                onLanguageChange={onLanguageChange}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Expansive natural workspace layout */}
      <main className={styles.main}>
        <div className={styles.mainContent}>{children}</div>
      </main>

      {/* Persistent Quiet Safety Notice Bar */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p className={styles.disclaimerText}>
            <span className={styles.disclaimerLabel}>Clinical Note:</span>{" "}
            {t.disclaimer.notice}
          </p>
          <div className={styles.emergencyTag}>
            <span className={styles.emergencyIcon}>!</span>
            <span>{t.disclaimer.emergency}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
