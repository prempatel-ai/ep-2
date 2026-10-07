import { describe, it, expect } from "vitest";
import {
  voiceMachineReducer,
  initialVoiceState,
  type VoiceSessionState,
} from "./voiceStateMachine";

describe("voiceMachineReducer", () => {
  it("transitions through standard turn: idle -> listening -> capturing -> thinking -> speaking -> listening", () => {
    let s = voiceMachineReducer(initialVoiceState, { type: "START_LISTENING" });
    expect(s.machineState).toBe("listening");

    s = voiceMachineReducer(s, { type: "SPEECH_DETECTED" });
    expect(s.machineState).toBe("capturing");
    expect(s.currentTurn).toBe(1);

    s = voiceMachineReducer(s, { type: "SPEECH_ENDED" });
    expect(s.machineState).toBe("thinking");

    s = voiceMachineReducer(s, { type: "TRANSCRIPT_READY", text: "What are symptoms?" });
    expect(s.transcript).toBe("What are symptoms?");

    s = voiceMachineReducer(s, { type: "FIRST_SENTENCE" });
    expect(s.machineState).toBe("speaking");

    s = voiceMachineReducer(s, { type: "REPLY_FINISHED" });
    expect(s.machineState).toBe("listening");
  });

  it("handles barge-in / speech start during speaking by advancing turn and entering capturing", () => {
    const speakingState: VoiceSessionState = {
      machineState: "speaking",
      currentTurn: 1,
      transcript: "Previous query",
      errorMessage: null,
    };

    const next = voiceMachineReducer(speakingState, { type: "SPEECH_START_DURING_SPEAK" });
    expect(next.machineState).toBe("capturing");
    expect(next.currentTurn).toBe(2);
    expect(next.transcript).toBe("");
  });

  it("handles no_speech by recovering back to listening", () => {
    const thinkingState: VoiceSessionState = {
      machineState: "thinking",
      currentTurn: 1,
      transcript: "",
      errorMessage: null,
    };

    const next = voiceMachineReducer(thinkingState, { type: "NO_SPEECH" });
    expect(next.machineState).toBe("listening");
  });

  it("handles error transitions", () => {
    const s = voiceMachineReducer(initialVoiceState, {
      type: "ERROR",
      message: "Microphone permission denied",
    });
    expect(s.machineState).toBe("error");
    expect(s.errorMessage).toBe("Microphone permission denied");
  });

  it("handles VAD_MISFIRE when capturing by resetting back to listening", () => {
    let s = voiceMachineReducer(initialVoiceState, { type: "START_LISTENING" });
    s = voiceMachineReducer(s, { type: "SPEECH_DETECTED" });
    expect(s.machineState).toBe("capturing");
    expect(s.currentTurn).toBe(1);

    // Misfire occurs (e.g. cough or transient noise < minSpeechMs)
    s = voiceMachineReducer(s, { type: "VAD_MISFIRE" });
    expect(s.machineState).toBe("listening");
    expect(s.currentTurn).toBe(0);
  });

  it("ignores VAD_MISFIRE while speaking so playback continues uninterrupted", () => {
    const speakingState: VoiceSessionState = {
      machineState: "speaking",
      currentTurn: 1,
      transcript: "Previous query",
      errorMessage: null,
    };

    const next = voiceMachineReducer(speakingState, { type: "VAD_MISFIRE" });
    expect(next.machineState).toBe("speaking");
    expect(next.currentTurn).toBe(1);
  });

  it("handles SPEECH_REAL_START during speaking to trigger barge-in", () => {
    const speakingState: VoiceSessionState = {
      machineState: "speaking",
      currentTurn: 1,
      transcript: "Previous query",
      errorMessage: null,
    };

    const next = voiceMachineReducer(speakingState, { type: "SPEECH_REAL_START" });
    expect(next.machineState).toBe("capturing");
    expect(next.currentTurn).toBe(2);
    expect(next.transcript).toBe("");
  });
});
