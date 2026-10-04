import React, { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { Mic, Send, Square } from "lucide-react";
import styles from "./Composer.module.css";

interface ComposerProps {
  isSubmitting: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onSwitchToVoice?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_CHARACTERS = 2000;

export function Composer({
  isSubmitting,
  onSend,
  onStop,
  onSwitchToVoice,
  disabled = false,
  placeholder = "Type your breast cancer symptom, screening, or medical FAQ inquiry...",
}: ComposerProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isSubmitting) {
      textareaRef.current?.focus();
    }
  }, [isSubmitting]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSubmitting || disabled) return;
    if (trimmed.length > MAX_CHARACTERS) return;

    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const remainingChars = MAX_CHARACTERS - text.length;
  const isTooLong = remainingChars < 0;

  return (
    <form className={styles.composerForm} onSubmit={handleSubmit} role="search">
      <div className={styles.inputBox}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          className={`${styles.textarea} ${isTooLong ? styles.textareaError : ""}`}
          rows={1}
          maxLength={MAX_CHARACTERS + 100}
          aria-label="Ask a medical information question"
        />

        <div className={styles.composerToolbar}>
          <div className={styles.metaSection}>
            <span className={styles.shortcutHint}>Press ↵ Enter to send, Shift+↵ for new line</span>
            {text.length > 1500 && (
              <span
                className={`${styles.charCount} ${
                  isTooLong ? styles.charCountError : ""
                }`}
              >
                {remainingChars} chars remaining
              </span>
            )}
          </div>

          <div className={styles.actionSection}>
            {onSwitchToVoice && !isSubmitting && (
              <button
                type="button"
                onClick={onSwitchToVoice}
                className={styles.voiceTrigger}
                aria-label="Switch to voice input"
                title="Voice mode"
              >
                <Mic size={15} aria-hidden="true" />
              </button>
            )}

            {isSubmitting ? (
              <button
                type="button"
                onClick={onStop}
                className={styles.stopButton}
                aria-label="Stop current response generation"
              >
                <Square size={11} fill="currentColor" aria-hidden="true" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim() || disabled || isTooLong}
                className={styles.submitButton}
                aria-label="Send clinical inquiry"
              >
                <Send size={13} aria-hidden="true" />
                <span>Submit Query</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
