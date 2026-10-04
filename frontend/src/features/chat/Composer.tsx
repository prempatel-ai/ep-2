import React, {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Mic, AudioLines, ChevronDown, Send, Square } from "lucide-react";
import styles from "./Composer.module.css";

interface ComposerProps {
  isSubmitting: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onSwitchToVoice?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

const MAX_CHARACTERS = 2000;

export function Composer({
  isSubmitting,
  onSend,
  onStop,
  onSwitchToVoice,
  disabled = false,
  placeholder = "Ask a question about breast cancer symptoms, screening, or treatment...",
}: ComposerProps) {
  const [text, setText] = useState("");
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const hasText = text.trim().length > 0;
  const remainingChars = MAX_CHARACTERS - text.length;
  const isTooLong = remainingChars < 0;

  useEffect(() => {
    if (!isSubmitting) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [isSubmitting]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  // Close voice menu on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && showVoiceMenu) {
        setShowVoiceMenu(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowVoiceMenu(false);
      }
    };

    if (showVoiceMenu) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showVoiceMenu]);

  const startDictation = () => {
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setText(transcript);
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(
              textareaRef.current.scrollHeight,
              140,
            )}px`;
          }
        }
      };

      recognition.onerror = () => {
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsDictating(true);
    } catch {
      setIsDictating(false);
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsDictating(false);
  };

  const handleDictateToggle = () => {
    if (isDictating) {
      stopDictation();
    } else {
      startDictation();
    }
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isSubmitting || disabled) return;
    if (trimmed.length > MAX_CHARACTERS) return;

    if (isDictating) {
      stopDictation();
    }

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
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140,
      )}px`;
    }
  };

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
            <span className={styles.shortcutHint}>
              Press ↵ Enter to send, Shift+↵ for new line
            </span>
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
            {/* If currently generating, show Stop response button */}
            {isSubmitting ? (
              <button
                type="button"
                onClick={onStop}
                className={styles.stopButton}
                aria-label="Stop current response generation"
                title="Stop response"
              >
                <Square size={11} fill="currentColor" aria-hidden="true" />
                <span>Stop</span>
              </button>
            ) : hasText ? (
              /* STATE 2 — USER IS TYPING: Only Send button remains */
              <button
                type="submit"
                disabled={disabled || isTooLong}
                className={styles.sendButton}
                aria-label="Send message"
                title="Send message"
              >
                <Send size={14} aria-hidden="true" />
              </button>
            ) : (
              /* STATE 1 — EMPTY INPUT: Grouped [Microphone] [Voice] [Chevron] */
              <div className={styles.voiceControlGroup}>
                <button
                  type="button"
                  onClick={handleDictateToggle}
                  className={`${styles.voiceButton} ${
                    isDictating ? styles.voiceButtonActive : ""
                  }`}
                  aria-label="Dictate"
                  title="Dictate"
                >
                  <Mic size={15} aria-hidden="true" />
                </button>

                {onSwitchToVoice && (
                  <button
                    type="button"
                    onClick={onSwitchToVoice}
                    className={styles.voiceButton}
                    aria-label="Voice conversation"
                    title="Voice conversation"
                  >
                    <AudioLines size={15} aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowVoiceMenu((prev) => !prev)}
                  className={`${styles.voiceButton} ${styles.chevronButton}`}
                  aria-label="Voice options"
                  title="Voice options"
                  aria-expanded={showVoiceMenu}
                >
                  <ChevronDown size={13} aria-hidden="true" />
                </button>

                {/* Lightweight Voice Options Popover Menu */}
                {showVoiceMenu && (
                  <div
                    ref={menuRef}
                    className={styles.voiceMenu}
                    role="menu"
                    aria-label="Voice options menu"
                  >
                    <div className={styles.menuHeader}>Voice options</div>

                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={() => {
                        setShowVoiceMenu(false);
                        handleDictateToggle();
                      }}
                    >
                      <Mic size={14} className={styles.menuIcon} aria-hidden="true" />
                      <div className={styles.menuItemContent}>
                        <span className={styles.menuItemTitle}>Dictation</span>
                        <span className={styles.menuItemDesc}>
                          Speak to enter text
                        </span>
                      </div>
                    </button>

                    {onSwitchToVoice && (
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.menuItem}
                        onClick={() => {
                          setShowVoiceMenu(false);
                          onSwitchToVoice();
                        }}
                      >
                        <AudioLines
                          size={14}
                          className={styles.menuIcon}
                          aria-hidden="true"
                        />
                        <div className={styles.menuItemContent}>
                          <span className={styles.menuItemTitle}>
                            Voice conversation
                          </span>
                          <span className={styles.menuItemDesc}>
                            Talk with Sahayak
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
