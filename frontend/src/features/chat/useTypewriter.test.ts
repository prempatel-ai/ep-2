import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTypewriter } from "./useTypewriter";

describe("useTypewriter hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns full text immediately when isStreaming is false", () => {
    const { result } = renderHook(() =>
      useTypewriter("Breast cancer symptoms include painless lumps.", false)
    );
    expect(result.current).toBe("Breast cancer symptoms include painless lumps.");
  });

  it("progressively animates text when isStreaming is true", () => {
    let frameCallback: FrameRequestCallback = () => {};
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frameCallback = cb;
      return 1;
    });

    const { result } = renderHook(() =>
      useTypewriter("Hello world", true)
    );

    // Initial state before animation frame is empty or initial slice
    expect(result.current.length).toBeLessThanOrEqual("Hello world".length);

    // Advance animation frame
    act(() => {
      frameCallback(performance.now() + 20);
    });

    expect(result.current.length).toBeGreaterThanOrEqual(1);
  });

  it("completes immediately when isStreaming turns false", () => {
    let isStreaming = true;
    const { result, rerender } = renderHook(() =>
      useTypewriter("Complete clinical response.", isStreaming)
    );

    // Turn streaming off
    isStreaming = false;
    rerender();

    expect(result.current).toBe("Complete clinical response.");
  });
});
