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
      {/* Top Header - Production Grade, Refined Clinical Hierarchy */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <div className={styles.brandIcon} aria-hidden="true">
              સ
            </div>
            <div className={styles.brandInfo}>
              <div className={styles.brandTitleRow}>
                <h1 className={styles.title}>{t.app.title}</h1>
                <span className={styles.badgeOffline}>Offline Core</span>
              </div>
              <p className={styles.subtitle}>{t.app.subtitle}</p>
            </div>
          </div>

          <div className={styles.headerActions}>
            {/* Status indicator */}
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

      {/* Main Content Area */}
      <main className={styles.main}>
        <div className={styles.mainContent}>{children}</div>
      </main>

      {/* Footer - Mandatory clinical safety disclaimers & emergency helpline pill */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p className={styles.disclaimerText}>{t.disclaimer.notice}</p>
          <div className={styles.emergencyPill}>
            <span>🚨</span>
            <span>{t.disclaimer.emergency}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
