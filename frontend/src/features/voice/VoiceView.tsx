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
  const [captureJitter, setCaptureJitter] = useState<{ avgJitterMs: number; maxJitterMs: number } | null>(null);
  const [playbackUnderruns, setPlaybackUnderruns] = useState(0);
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
        const j = recorderRef.current?.getJitterMetrics();
        if (j) setCaptureJitter({ avgJitterMs: j.avgJitterMs, maxJitterMs: j.maxJitterMs });
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
        playerRef.current?.markTurnDone();
        setPlaybackUnderruns(playerRef.current?.getUnderrunCount() ?? 0);
        const j = recorderRef.current?.getJitterMetrics();
        if (j) setCaptureJitter({ avgJitterMs: j.avgJitterMs, maxJitterMs: j.maxJitterMs });
      },
      onNoSpeech: () => {
        dispatch({ type: "NO_SPEECH" });
      },
      onInterrupted: () => {
        playerRef.current?.flush();
        setPlaybackUnderruns(playerRef.current?.getUnderrunCount() ?? 0);
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
      case "capturing":
        return "Listening...";
      case "thinking":
        return "Thinking...";
      case "speaking":
        return "Sahayak is speaking";
      case "error":
        return "Microphone unavailable";
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
        captureJitter={captureJitter}
        playbackUnderruns={playbackUnderruns}
      />

      {/* Top Bar Navigation */}
      <div className={styles.topBar}>
        <button
          type="button"
          onClick={onExitVoice}
          className={styles.exitButton}
          aria-label="Switch back to text chat"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          <span>Return to text chat</span>
        </button>
      </div>

      {voiceState.errorMessage && (
        <div className={styles.errorAlert} role="alert">
          <div className={styles.errorAlertRow}>
            <AlertCircle size={15} className={styles.alertIcon} aria-hidden="true" />
            <span>{voiceState.errorMessage}</span>
          </div>
          <p className={styles.errorHint}>
            Please check that your microphone is connected and browser permission is granted.
          </p>
        </div>
      )}

      {/* Central Audio Tool Interaction */}
      <div className={styles.audioStage}>
        <div className={styles.micContainer}>
          <VoicePresence
            state={voiceState.machineState}
            onPress={voiceState.machineState === "speaking" ? handleInterrupt : undefined}
          />
        </div>

        <div className={styles.statusSection}>
          <h3 className={styles.statusHeading}>{getStateLabel()}</h3>
          <p className={styles.statusSubtext}>Speak naturally in Gujarati, Hindi, or English</p>
        </div>

        {/* Clean Controls: Stop and Exit */}
        <div className={styles.actionsRow}>
          {voiceState.machineState === "speaking" && (
            <button
              type="button"
              className={styles.stopButton}
              onClick={handleInterrupt}
              aria-label="Stop assistant speech"
            >
              <Square size={12} fill="currentColor" aria-hidden="true" />
              <span>Stop</span>
            </button>
          )}

          <button
            type="button"
            className={styles.exitVoiceButton}
            onClick={onExitVoice}
            aria-label="Exit voice conversation"
          >
            <span>Exit Voice Mode</span>
          </button>
        </div>
      </div>

      {/* Transcript and Response Card */}
      {(voiceState.transcript || latestAssistantText) && (
        <div className={styles.transcriptSection}>
          {voiceState.transcript && (
            <div className={styles.userBubble}>
              <span className={styles.speakerTag}>You</span>
              <p className={styles.transcriptText}>{voiceState.transcript}</p>
            </div>
          )}

          {latestAssistantText && (
            <div className={styles.assistantBubble}>
              <div className={styles.assistantHeader}>
                <span className={styles.speakerTag}>Sahayak</span>
                {latestSource && <SourceBadge source={latestSource} />}
              </div>
              <p className={styles.assistantText}>{latestAssistantText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
