import React, { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import styles from "./Composer.module.css";

interface ComposerProps {
  isSubmitting: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_CHARACTERS = 2000;

export function Composer({
  isSubmitting,
  onSend,
  onStop,
  disabled = false,
  placeholder = "Ask a question about breast cancer symptoms, screening, or FAQs...",
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const remainingChars = MAX_CHARACTERS - text.length;
  const isTooLong = remainingChars < 0;

  return (
    <form className={styles.composerForm} onSubmit={handleSubmit} role="search">
      <div className={styles.inputContainer}>
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

        <div className={styles.controlsRow}>
          <div className={styles.metaInfo}>
            {text.length > 1500 && (
              <span
                className={`${styles.charCount} ${
                  isTooLong ? styles.charCountError : ""
                }`}
              >
                {remainingChars} characters remaining
              </span>
            )}
          </div>

          <div className={styles.actions}>
            {isSubmitting ? (
              <button
                type="button"
                onClick={onStop}
                className={styles.stopButton}
                aria-label="Stop generation"
              >
                <span className={styles.stopSquare} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim() || disabled || isTooLong}
                className={styles.sendButton}
                aria-label="Send message"
              >
                <span>Send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
