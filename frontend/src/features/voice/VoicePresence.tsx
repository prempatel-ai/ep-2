import React from "react";
import { Mic } from "lucide-react";
import styles from "./VoicePresence.module.css";
import type { VoiceMachineState } from "./voiceStateMachine";

interface VoicePresenceProps {
  state: VoiceMachineState;
  onPress?: () => void;
}

export function VoicePresence({ state, onPress }: VoicePresenceProps) {
  const isAudioActive = state === "speaking" || state === "capturing";

  return (
    <div className={styles.container} aria-hidden="true">
      {/* Subtle reactive audio ring when hearing speech or speaking */}
      {isAudioActive && (
        <div className={`${styles.audioRing} ${styles[`audioRing_${state}`] || ""}`} />
      )}

      {/* Clean 80px physical microphone button */}
      <button
        type="button"
        className={`${styles.micButton} ${styles[`mic_${state}`] || ""}`}
        onClick={onPress}
        tabIndex={-1}
        aria-label="Microphone indicator"
      >
        <Mic className={styles.micIcon} size={32} />
      </button>
    </div>
  );
}
