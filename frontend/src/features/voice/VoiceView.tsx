import React, { useState, useEffect, useRef, useReducer, useCallback } from "react";
import type { LanguageCode, TurnMetrics } from "@/api/types";
import { VoiceSocket } from "@/api/voiceSocket";
import { AudioRecorder } from "@/audio/recorder";
import { AudioQueuePlayer } from "@/audio/player";
import {
  voiceMachineReducer,
  initialVoiceState,
} from "./voiceStateMachine";
import { ArrowLeft, AlertCircle, Square } from "lucide-react";
import { VoicePresence } from "./VoicePresence";
import { SourceBadge } from "@/features/chat/SourceBadge";
import { DevPanel } from "./DevPanel";
import styles from "./VoiceView.module.css";

interface VoiceViewProps {
  currentLanguage: LanguageCode;
  onExitVoice?: () => void;
}

export function VoiceView({ currentLanguage, onExitVoice }: VoiceViewProps) {
  const [voiceState, dispatch] = useReducer(voiceMachineReducer, initialVoiceState);
  const [latestAssistantText, setLatestAssistantText] = useState("");
  const [latestSource, setLatestSource] = useState<"safety" | "faq" | "model" | null>(null);
  const [metrics, setMetrics] = useState<TurnMetrics | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [voiceServerReady, setVoiceServerReady] = useState(false);
  void voiceServerReady;

  const socketRef = useRef<VoiceSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioQueuePlayer | null>(null);
  const stateRef = useRef(voiceState);

  useEffect(() => {
    stateRef.current = voiceState;
  }, [voiceState]);


  const handleInterrupt = useCallback(() => {
    playerRef.current?.flush();
    socketRef.current?.sendInterrupt();
    dispatch({ type: "SPEECH_START_DURING_SPEAK" });
  }, []);

  useEffect(() => {
    playerRef.current = new AudioQueuePlayer(() => {
      dispatch({ type: "REPLY_FINISHED" });
    });

    recorderRef.current = new AudioRecorder({
      onSpeechStart: () => {
        if (stateRef.current.machineState === "speaking") {
          handleInterrupt();
        } else {
          dispatch({ type: "SPEECH_DETECTED" });
        }
      },
      onSpeechEnd: (pcmData) => {
        dispatch({ type: "SPEECH_ENDED" });
        socketRef.current?.sendUtterance(pcmData);
      },
    });

    const socket = new VoiceSocket({
      onReady: (_sessId, voiceAvail) => {
        setVoiceServerReady(voiceAvail);
        dispatch({ type: "START_LISTENING" });
        void recorderRef.current?.start().catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Microphone access denied";
          dispatch({ type: "ERROR", message: msg });
        });
      },
      onTranscript: (text) => {
        dispatch({ type: "TRANSCRIPT_READY", text });
        setLatestAssistantText("");
        setLatestSource(null);
      },
      onSentence: (_index, text, source) => {
        dispatch({ type: "FIRST_SENTENCE" });
        setLatestAssistantText((prev) => (prev ? `${prev} ${text}` : text));
        setLatestSource(source as "safety" | "faq" | "model");
      },
      onAudio: (index, wavBytes) => {
        void playerRef.current?.enqueueWav(index, wavBytes);
      },
      onDone: (source, m) => {
        setMetrics(m as TurnMetrics);
        if (source) setLatestSource(source as "safety" | "faq" | "model");
      },
      onNoSpeech: () => {
        dispatch({ type: "NO_SPEECH" });
      },
      onInterrupted: () => {
        playerRef.current?.flush();
        dispatch({ type: "REPLY_FINISHED" });
      },
      onError: (_code, message) => {
        dispatch({ type: "ERROR", message });
      },
    });

    socketRef.current = socket;
    socket.connect(undefined, currentLanguage);

    return () => {
      recorderRef.current?.stop();
      playerRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, [currentLanguage, handleInterrupt]);


  const getStateLabel = () => {
    switch (voiceState.machineState) {
      case "listening":
        return "Listening (speak anytime)...";
      case "capturing":
        return "Hearing your speech...";
      case "thinking":
        return "Thinking...";
      case "speaking":
        return "Sahayak is speaking (tap or speak to interrupt)";
      case "error":
        return "Microphone or connection issue";
      default:
        return "Voice inactive";
    }
  };

  return (
    <div className={styles.container}>
      <DevPanel
        metrics={metrics}
        currentTurn={voiceState.currentTurn}
        isOpen={devOpen}
        onToggle={() => setDevOpen(!devOpen)}
      />

      {/* Top Bar Navigation */}
      <div className={styles.topBar}>
        <button
          type="button"
          onClick={onExitVoice}
          className={styles.exitButton}
          aria-label="Switch back to text chat"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Return to Text Chat</span>
        </button>
      </div>

      {voiceState.errorMessage && (
        <div className={styles.errorAlert} role="alert">
          <div className={styles.errorAlertRow}>
            <AlertCircle size={15} className={styles.alertIcon} aria-hidden="true" />
            <span>{voiceState.errorMessage}</span>
          </div>
          <p className={styles.errorHint}>
            Please check that your microphone is connected and permissions are granted.
          </p>
        </div>
      )}

      {/* Central Interactive Voice Presence Region */}
      <div className={styles.orbStage}>
        <div className={styles.orbWrapper}>
          <VoicePresence state={voiceState.machineState} />
        </div>

        <div className={styles.statusIndicator}>
          <span
            className={`${styles.statusPill} ${
              styles[`pill_${voiceState.machineState}`] || ""
            }`}
          >
            {getStateLabel()}
          </span>
        </div>

        <p className={styles.headphoneTip}>
          Tip: Wearing headphones helps prevent your speaker sound from being picked up as an interruption.
        </p>
      </div>

      {/* Transcript and Response Card */}
      {(voiceState.transcript || latestAssistantText) && (
        <div className={styles.transcriptSection}>
          {voiceState.transcript && (
            <div className={styles.userBubble}>
              <span className={styles.speakerTag}>You:</span>
              <p className={styles.transcriptText}>{voiceState.transcript}</p>
            </div>
          )}

          {latestAssistantText && (
            <div className={styles.assistantBubble}>
              <div className={styles.assistantHeader}>
                <span className={styles.speakerTag}>Sahayak:</span>
                {latestSource && <SourceBadge source={latestSource} />}
              </div>
              <p className={styles.assistantText}>{latestAssistantText}</p>
            </div>
          )}
        </div>
      )}

      {/* Primary Push-to-Interrupt / Stop control */}
      <div className={styles.controlsBar}>
        {voiceState.machineState === "speaking" ? (
          <button
            type="button"
            className={styles.interruptButton}
            onClick={handleInterrupt}
            aria-label="Interrupt assistant speech"
          >
            <Square size={12} fill="currentColor" aria-hidden="true" />
            <span>Interrupt / Stop Speaking</span>
          </button>
        ) : (
          <div className={styles.liveVoiceTag}>
            <span className={styles.pulseLive} />
            <span>Voice mode active ({currentLanguage.toUpperCase()})</span>
          </div>
        )}
      </div>
    </div>
  );
}
