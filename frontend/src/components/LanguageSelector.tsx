'use client'

import * as React from 'react'
import { Check, Globe, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { LanguageCode } from '@/api/types'
import styles from './LanguageSelector.module.css'

interface LanguageOption {
  code: LanguageCode
  label: string
  nativeLabel: string
}

const languages: LanguageOption[] = [
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
]

interface LanguageSelectorProps {
  currentLanguage: LanguageCode
  onLanguageChange?: (lang: LanguageCode) => void
}

export function LanguageSelector({
  currentLanguage,
  onLanguageChange,
}: LanguageSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const activeLang = languages.find((l) => l.code === currentLanguage) || languages[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={styles.triggerButton}
          aria-expanded={open}
          aria-label="Select language"
        >
          <Globe className={styles.globeIcon} aria-hidden="true" />
          <span className={styles.activeLabel}>{activeLang.nativeLabel}</span>
          <span className={styles.activeSub}>({activeLang.label})</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={styles.popoverMenu}>
        <div className={styles.menuHeader}>
          <span>Select language / ભાષા પસંદ કરો</span>
          <button
            type="button"
            className={styles.mobileCloseBtn}
            onClick={() => setOpen(false)}
            aria-label="Close language selector"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.optionsList} role="listbox" aria-label="Available languages">
          {languages.map((lang) => {
            const isSelected = lang.code === currentLanguage
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.optionItem} ${isSelected ? styles.optionSelected : ''}`}
                onClick={() => {
                  onLanguageChange?.(lang.code)
                  setOpen(false)
                }}
              >
                <div className={styles.optionText}>
                  <span className={styles.nativeText}>{lang.nativeLabel}</span>
                  <span className={styles.subText}>{lang.label}</span>
                </div>
                {isSelected && <Check className={styles.checkIcon} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
