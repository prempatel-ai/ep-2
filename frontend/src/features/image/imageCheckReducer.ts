/**
 * Pure state reducer for Image Check flow (Phase 20).
 * Manages consent, file selection, analysis lifecycle, and neutral result presentation.
 * Pure logic only; zero side-effects, zero storage APIs, zero network calls.
 */

import type { ImageCheckResponse } from "@/api/types";

export type ImageCheckStep =
  | "consent"
  | "picker"
  | "analyzing"
  | "result"
  | "error";

export interface ImageCheckState {
  step: ImageCheckStep;
  adultConfirmed: boolean;
  selectedFile: File | Blob | null;
  previewUrl: string | null;
  result: ImageCheckResponse | null;
  errorMessage: string | null;
}

export type ImageCheckAction =
  | { type: "CONFIRM_ADULT"; confirmed: boolean }
  | { type: "SELECT_IMAGE"; file: File | Blob; previewUrl: string }
  | { type: "REMOVE_IMAGE" }
  | { type: "START_ANALYSIS" }
  | { type: "ANALYSIS_SUCCESS"; response: ImageCheckResponse }
  | { type: "ANALYSIS_ERROR"; message: string }
  | { type: "ANALYSIS_CANCELLED" }
  | { type: "RESET" };

export const initialImageCheckState: ImageCheckState = {
  step: "consent",
  adultConfirmed: false,
  selectedFile: null,
  previewUrl: null,
  result: null,
  errorMessage: null,
};

export function imageCheckReducer(
  state: ImageCheckState,
  action: ImageCheckAction,
): ImageCheckState {
  switch (action.type) {
    case "CONFIRM_ADULT": {
      if (action.confirmed) {
        return {
          ...state,
          adultConfirmed: true,
          step: state.selectedFile ? "picker" : "picker",
          errorMessage: null,
        };
      }
      return {
        ...state,
        adultConfirmed: false,
        step: "consent",
        selectedFile: null,
        previewUrl: null,
        result: null,
        errorMessage: null,
      };
    }

    case "SELECT_IMAGE": {
      return {
        ...state,
        selectedFile: action.file,
        previewUrl: action.previewUrl,
        step: "picker",
        result: null,
        errorMessage: null,
      };
    }

    case "REMOVE_IMAGE": {
      return {
        ...state,
        selectedFile: null,
        previewUrl: null,
        step: "picker",
        result: null,
        errorMessage: null,
      };
    }

    case "START_ANALYSIS": {
      if (!state.selectedFile || !state.adultConfirmed) {
        return state;
      }
      return {
        ...state,
        step: "analyzing",
        errorMessage: null,
      };
    }

    case "ANALYSIS_SUCCESS": {
      return {
        ...state,
        step: "result",
        result: action.response,
        errorMessage: null,
      };
    }

    case "ANALYSIS_ERROR": {
      return {
        ...state,
        step: "error",
        errorMessage: action.message,
      };
    }

    case "ANALYSIS_CANCELLED": {
      return {
        ...state,
        step: state.selectedFile ? "picker" : "consent",
        errorMessage: null,
      };
    }

    case "RESET": {
      return {
        ...initialImageCheckState,
        // Keep adult consent confirmation within the active session if previously checked
        adultConfirmed: state.adultConfirmed,
        step: state.adultConfirmed ? "picker" : "consent",
      };
    }

    default:
      return state;
  }
}
