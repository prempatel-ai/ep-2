import type { ReactNode } from "react";
import styles from "./AppShell.module.css";
import type { LanguageCode } from "@/api/types";
import { getTranslation } from "@/i18n";

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
      {/* Top Header - Restrained, clean typographic hierarchy */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <div className={styles.brandTitleRow}>
              <h1 className={styles.title}>{t.app.title}</h1>
              <span className={styles.badgeOffline}>Offline Core</span>
            </div>
            <p className={styles.subtitle}>{t.app.subtitle}</p>
          </div>

          <div className={styles.headerActions}>
            {/* Status indicator - Minimal, accessible */}
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

            {/* Language Selector */}
            <div className={styles.languageControl}>
              <label htmlFor="language-select" className={styles.srOnly}>
                Language
              </label>
              <select
                id="language-select"
                className={styles.languageSelect}
                value={currentLanguage}
                onChange={(e) => onLanguageChange?.(e.target.value as LanguageCode)}
              >
                <option value="gu">ગુજરાતી (Gujarati)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.main}>
        <div className={styles.mainContent}>{children}</div>
      </main>

      {/* Footer - Mandatory clinical safety disclaimers */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <p className={styles.disclaimerText}>{t.disclaimer.notice}</p>
          <p className={styles.emergencyText}>{t.disclaimer.emergency}</p>
        </div>
      </footer>
    </div>
  );
}
