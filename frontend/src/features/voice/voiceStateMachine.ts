export type VoiceMachineState =
  | "idle"
  | "listening"
  | "capturing"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "error";

export interface VoiceSessionState {
  machineState: VoiceMachineState;
  currentTurn: number;
  transcript: string;
  errorMessage: string | null;
}

export type VoiceMachineAction =
  | { type: "START_LISTENING" }
  | { type: "SPEECH_DETECTED" }
  | { type: "SPEECH_REAL_START" }
  | { type: "VAD_MISFIRE" }
  | { type: "SPEECH_ENDED" }
  | { type: "TRANSCRIPT_READY"; text: string }
  | { type: "FIRST_SENTENCE" }
  | { type: "SPEECH_START_DURING_SPEAK" } // triggers barge-in / interrupt
  | { type: "REPLY_FINISHED" }
  | { type: "NO_SPEECH" }
  | { type: "ERROR"; message: string }
  | { type: "STOP" };

export const initialVoiceState: VoiceSessionState = {
  machineState: "idle",
  currentTurn: 0,
  transcript: "",
  errorMessage: null,
};

export function voiceMachineReducer(
  state: VoiceSessionState,
  action: VoiceMachineAction,
): VoiceSessionState {
  switch (action.type) {
    case "START_LISTENING":
      return {
        ...state,
        machineState: "listening",
        errorMessage: null,
      };

    case "SPEECH_DETECTED":
      return {
        ...state,
        machineState: "capturing",
        currentTurn: state.currentTurn + 1,
        transcript: "",
        errorMessage: null,
      };

    case "SPEECH_REAL_START":
      if (state.machineState === "speaking") {
        return {
          ...state,
          machineState: "capturing",
          currentTurn: state.currentTurn + 1,
          transcript: "",
        };
      }
      return state;

    case "VAD_MISFIRE":
      if (state.machineState === "capturing") {
        return {
          ...state,
          machineState: "listening",
          currentTurn: Math.max(0, state.currentTurn - 1),
          transcript: "",
        };
      }
      return state;

    case "SPEECH_ENDED":
      return {
        ...state,
        machineState: "thinking",
      };

    case "TRANSCRIPT_READY":
      return {
        ...state,
        transcript: action.text,
      };

    case "FIRST_SENTENCE":
      return {
        ...state,
        machineState: "speaking",
      };

    case "SPEECH_START_DURING_SPEAK":
      // User interrupted the assistant: advance turn counter immediately
      return {
        ...state,
        machineState: "capturing",
        currentTurn: state.currentTurn + 1,
        transcript: "",
      };

    case "REPLY_FINISHED":
    case "NO_SPEECH":
      return {
        ...state,
        machineState: "listening",
      };

    case "ERROR":
      return {
        ...state,
        machineState: "error",
        errorMessage: action.message,
      };

    case "STOP":
      return {
        ...state,
        machineState: "idle",
        errorMessage: null,
      };

    default:
      return state;
  }
}
