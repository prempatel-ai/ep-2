import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Mic, AudioLines, ChevronDown, Send, Square, Check } from "lucide-react";
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

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

const DEFAULT_AUDIO_DEVICES: AudioInputDevice[] = [
  { deviceId: "default", label: "Microphone Array (Realtek(R) Audio)" },
  { deviceId: "default-sys", label: "Default - Microphone Array" },
  { deviceId: "comm-sys", label: "Communications - Microphone Array" },
];

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
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [audioDevices, setAudioDevices] =
    useState<AudioInputDevice[]>(DEFAULT_AUDIO_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("sahayak_selected_mic_id") || "default";
    }
    return "default";
  });
  const [micLevel, setMicLevel] = useState<number>(24);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const chevronBtnRef = useRef<HTMLButtonElement>(null);
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

  // Enumerate real audio input devices
  const loadAudioDevices = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return;
    }

    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let audioInputs = devices.filter((d) => d.kind === "audioinput");

      // If permissions haven't been granted yet, labels may be empty strings
      const hasEmptyLabels = audioInputs.some((d) => !d.label);
      if (hasEmptyLabels && navigator.mediaDevices.getUserMedia) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          devices = await navigator.mediaDevices.enumerateDevices();
          audioInputs = devices.filter((d) => d.kind === "audioinput");
          tempStream.getTracks().forEach((track) => track.stop());
        } catch {
          // ignore permission errors, proceed with fallback list
        }
      }

      if (audioInputs.length > 0) {
        const formatted: AudioInputDevice[] = audioInputs.map((d, index) => ({
          deviceId: d.deviceId || `device-${index}`,
          label:
            d.label ||
            (index === 0
              ? "Microphone Array (Default Audio)"
              : `Microphone ${index + 1}`),
        }));
        setAudioDevices(formatted);

        const saved =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("sahayak_selected_mic_id")
            : null;

        if (saved && formatted.some((d) => d.deviceId === saved)) {
          setSelectedDeviceId(saved);
        } else if (formatted.length > 0) {
          setSelectedDeviceId(formatted[0].deviceId);
          try {
            localStorage.setItem(
              "sahayak_selected_mic_id",
              formatted[0].deviceId,
            );
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Keep defaults
    }
  }, []);

  const handleToggleMicMenu = () => {
    setShowMicMenu((prev) => {
      const next = !prev;
      if (next) {
        void loadAudioDevices();
      }
      return next;
    });
  };

  // Listen to device changes
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      const handleDeviceChange = () => {
        void loadAudioDevices();
      };
      navigator.mediaDevices.addEventListener(
        "devicechange",
        handleDeviceChange,
      );
      return () => {
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          handleDeviceChange,
        );
      };
    }
  }, [loadAudioDevices]);

  // Live Microphone Input Level Meter when popover is open
  useEffect(() => {
    if (!showMicMenu) return;

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let animId: number | null = null;
    let isCancelled = false;

    const initAudioMeter = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMicLevel(30);
          return;
        }

        const constraints: MediaStreamConstraints = {
          audio:
            selectedDeviceId &&
            selectedDeviceId !== "default" &&
            selectedDeviceId !== "default-sys" &&
            selectedDeviceId !== "comm-sys"
              ? { deviceId: { exact: selectedDeviceId } }
              : true,
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioCtx = new AudioCtxClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!analyser || isCancelled) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale smoothly between 12% resting bar and 100% active speech
          const pct = Math.min(100, Math.max(12, Math.round((avg / 60) * 100)));
          setMicLevel(pct);
          animId = requestAnimationFrame(tick);
        };

        tick();
      } catch {
        // Fallback gentle indicator
        setMicLevel(25);
      }
    };

    initAudioMeter();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch {
          // ignore
        }
      }
    };
  }, [showMicMenu, selectedDeviceId, loadAudioDevices]);

  // Close microphone selection menu on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && showMicMenu) {
        setShowMicMenu(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        chevronBtnRef.current &&
        !chevronBtnRef.current.contains(e.target as Node)
      ) {
        setShowMicMenu(false);
      }
    };

    if (showMicMenu) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMicMenu]);

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    try {
      localStorage.setItem("sahayak_selected_mic_id", deviceId);
    } catch {
      // ignore
    }
  };

  const startDictation = () => {
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition ||
      windowWithSpeech.webkitSpeechRecognition;

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
              180,
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
        180,
      )}px`;
    }
  };

  return (
    <form
      className={styles.composerForm}
      onSubmit={handleSubmit}
      role="search"
    >
      <div className={styles.inputBox}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          className={`${styles.textarea} ${
            isTooLong ? styles.textareaError : ""
          }`}
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
              /* STATE 1 — EMPTY INPUT: Standalone Mic button + Voice split pill (Waveform + Mic dropdown) */
              <div className={styles.voiceControlGroup}>
                {/* Standalone Dictation Button */}
                <button
                  type="button"
                  onClick={handleDictateToggle}
                  className={`${styles.standaloneMicButton} ${
                    isDictating ? styles.standaloneMicActive : ""
                  }`}
                  aria-label={isDictating ? "Stop dictation" : "Dictate"}
                  title={isDictating ? "Stop dictation" : "Dictate"}
                >
                  <Mic size={16} aria-hidden="true" />
                </button>

                {/* Voice Mode + Microphone Selector Split Capsule Button */}
                <div className={styles.voiceSplitGroup}>
                  {onSwitchToVoice && (
                    <button
                      type="button"
                      onClick={onSwitchToVoice}
                      className={styles.voiceModeButton}
                      aria-label="Voice conversation"
                      title="Voice conversation"
                    >
                      <AudioLines size={16} aria-hidden="true" />
                    </button>
                  )}

                  <button
                    ref={chevronBtnRef}
                    type="button"
                    onClick={handleToggleMicMenu}
                    className={`${styles.chevronButton} ${
                      showMicMenu ? styles.chevronButtonActive : ""
                    }`}
                    aria-label="Select microphone"
                    title="Select microphone"
                    aria-expanded={showMicMenu}
                    aria-haspopup="menu"
                  >
                    <ChevronDown size={13} aria-hidden="true" />
                  </button>
                </div>

                {/* Microphone Selection Popover Menu */}
                {showMicMenu && (
                  <div
                    ref={menuRef}
                    className={styles.micPopoverMenu}
                    role="menu"
                    aria-label="Microphone selection menu"
                  >
                    {/* Live Input Level Header */}
                    <div className={styles.micMeterRow}>
                      <Mic
                        size={13}
                        className={styles.micMeterIcon}
                        aria-hidden="true"
                      />
                      <div className={styles.micMeterTrack}>
                        <div
                          className={styles.micMeterFill}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(10, micLevel),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Microphone Device List */}
                    <div className={styles.micDeviceList}>
                      {audioDevices.map((device) => {
                        const isSelected = selectedDeviceId === device.deviceId;
                        return (
                          <button
                            key={device.deviceId}
                            type="button"
                            role="menuitemradio"
                            aria-checked={isSelected}
                            className={`${styles.micDeviceItem} ${
                              isSelected ? styles.micDeviceItemSelected : ""
                            }`}
                            onClick={() => handleSelectDevice(device.deviceId)}
                          >
                            <span
                              className={styles.micDeviceLabel}
                              title={device.label}
                            >
                              {device.label}
                            </span>
                            {isSelected && (
                              <Check
                                size={14}
                                className={styles.checkIcon}
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
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
