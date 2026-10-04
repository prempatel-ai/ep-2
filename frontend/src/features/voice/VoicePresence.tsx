import React from "react";
import styles from "./VoicePresence.module.css";
import type { VoiceMachineState } from "./voiceStateMachine";

interface VoicePresenceProps {
  state: VoiceMachineState;
}

export function VoicePresence({ state }: VoicePresenceProps) {
  return (
    <div className={styles.stage} data-state={state} aria-hidden="true">
      {/* Outer subtle atmospheric aura */}
      <div className={`${styles.aura} ${styles[`aura_${state}`] || ""}`} />

      {/* Dynamic ripple rings */}
      <div className={`${styles.ring} ${styles.ring1} ${styles[`ring_${state}`] || ""}`} />
      <div className={`${styles.ring} ${styles.ring2} ${styles[`ring_${state}`] || ""}`} />

      {/* Core central voice orb - ChatGPT/OpenAI fluid clinical teal sphere */}
      <div className={`${styles.coreOrb} ${styles[`core_${state}`] || ""}`}>
        <div className={styles.innerGlow} />
      </div>
    </div>
  );
}
