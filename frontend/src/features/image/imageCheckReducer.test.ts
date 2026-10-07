import { describe, it, expect } from "vitest";
import {
  imageCheckReducer,
  initialImageCheckState,
  type ImageCheckState,
} from "./imageCheckReducer";
import type { ImageCheckResponse } from "@/api/types";

describe("imageCheckReducer pure state machine", () => {
  it("initializes in consent step with adultConfirmed false", () => {
    expect(initialImageCheckState.step).toBe("consent");
    expect(initialImageCheckState.adultConfirmed).toBe(false);
    expect(initialImageCheckState.selectedFile).toBeNull();
    expect(initialImageCheckState.previewUrl).toBeNull();
    expect(initialImageCheckState.result).toBeNull();
  });

  it("advances to picker on adult confirmation", () => {
    const state = imageCheckReducer(initialImageCheckState, {
      type: "CONFIRM_ADULT",
      confirmed: true,
    });
    expect(state.adultConfirmed).toBe(true);
    expect(state.step).toBe("picker");
  });

  it("reverts to consent when adult confirmation unchecked", () => {
    const readyState: ImageCheckState = {
      ...initialImageCheckState,
      adultConfirmed: true,
      step: "picker",
    };
    const state = imageCheckReducer(readyState, {
      type: "CONFIRM_ADULT",
      confirmed: false,
    });
    expect(state.adultConfirmed).toBe(false);
    expect(state.step).toBe("consent");
  });

  it("handles image selection and removal", () => {
    const dummyFile = new File(["dummy"], "test.png", { type: "image/png" });
    const pickerState: ImageCheckState = {
      ...initialImageCheckState,
      adultConfirmed: true,
      step: "picker",
    };

    const selected = imageCheckReducer(pickerState, {
      type: "SELECT_IMAGE",
      file: dummyFile,
      previewUrl: "blob:http://localhost/dummy-uuid",
    });

    expect(selected.selectedFile).toBe(dummyFile);
    expect(selected.previewUrl).toBe("blob:http://localhost/dummy-uuid");
    expect(selected.step).toBe("picker");

    const removed = imageCheckReducer(selected, { type: "REMOVE_IMAGE" });
    expect(removed.selectedFile).toBeNull();
    expect(removed.previewUrl).toBeNull();
    expect(removed.step).toBe("picker");
  });

  it("transitions to analyzing when start requested with file and consent", () => {
    const dummyFile = new File(["dummy"], "test.png", { type: "image/png" });
    const readyState: ImageCheckState = {
      ...initialImageCheckState,
      adultConfirmed: true,
      selectedFile: dummyFile,
      previewUrl: "blob:test",
      step: "picker",
    };

    const analyzing = imageCheckReducer(readyState, { type: "START_ANALYSIS" });
    expect(analyzing.step).toBe("analyzing");
  });

  it("ignores START_ANALYSIS without file or consent", () => {
    const noFileState: ImageCheckState = {
      ...initialImageCheckState,
      adultConfirmed: true,
      selectedFile: null,
      step: "picker",
    };
    expect(imageCheckReducer(noFileState, { type: "START_ANALYSIS" }).step).toBe("picker");

    const noConsentState: ImageCheckState = {
      ...initialImageCheckState,
      adultConfirmed: false,
      selectedFile: new File(["dummy"], "test.png", { type: "image/png" }),
      step: "consent",
    };
    expect(imageCheckReducer(noConsentState, { type: "START_ANALYSIS" }).step).toBe("consent");
  });

  it("handles ANALYSIS_SUCCESS with response", () => {
    const analyzingState: ImageCheckState = {
      ...initialImageCheckState,
      adultConfirmed: true,
      selectedFile: new File(["dummy"], "test.png", { type: "image/png" }),
      step: "analyzing",
    };

    const mockResponse: ImageCheckResponse = {
      status: "ok",
      findings: ["finding_redness"],
      referral_required: true,
      messages: {
        findings_summary: "Observed redness.",
        referral_guidance: "Please see a doctor.",
        educational_disclaimer: "Not a diagnosis.",
      },
    };

    const result = imageCheckReducer(analyzingState, {
      type: "ANALYSIS_SUCCESS",
      response: mockResponse,
    });

    expect(result.step).toBe("result");
    expect(result.result).toEqual(mockResponse);
  });

  it("handles ANALYSIS_ERROR and ANALYSIS_CANCELLED", () => {
    const analyzingState: ImageCheckState = {
      ...initialImageCheckState,
      adultConfirmed: true,
      selectedFile: new File(["dummy"], "test.png", { type: "image/png" }),
      step: "analyzing",
    };

    const errored = imageCheckReducer(analyzingState, {
      type: "ANALYSIS_ERROR",
      message: "Server unreachable",
    });
    expect(errored.step).toBe("error");
    expect(errored.errorMessage).toBe("Server unreachable");

    const cancelled = imageCheckReducer(analyzingState, {
      type: "ANALYSIS_CANCELLED",
    });
    expect(cancelled.step).toBe("picker");
  });

  it("resets state completely while preserving adult consent in session", () => {
    const endState: ImageCheckState = {
      step: "result",
      adultConfirmed: true,
      selectedFile: new File(["dummy"], "test.png", { type: "image/png" }),
      previewUrl: "blob:test",
      result: {
        status: "ok",
        findings: ["none_visible"],
        referral_required: true,
        messages: {
          findings_summary: "None visible.",
          referral_guidance: "Please consult doctor.",
          educational_disclaimer: "Not a diagnosis.",
        },
      },
      errorMessage: null,
    };

    const resetState = imageCheckReducer(endState, { type: "RESET" });
    expect(resetState.step).toBe("picker");
    expect(resetState.adultConfirmed).toBe(true);
    expect(resetState.selectedFile).toBeNull();
    expect(resetState.previewUrl).toBeNull();
    expect(resetState.result).toBeNull();
  });
});
