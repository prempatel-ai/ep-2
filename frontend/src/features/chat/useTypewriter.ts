import { useEffect, useState, useRef } from "react";

/**
 * Smoothly animates streaming text character-by-character / word-by-word like ChatGPT and Claude.
 * If isStreaming is false or user prefers reduced motion, text is displayed immediately.
 */
export function useTypewriter(targetText: string, isStreaming: boolean): string {
  const [displayedText, setDisplayedText] = useState(() => (isStreaming ? "" : targetText));
  const displayedLengthRef = useRef(isStreaming ? 0 : targetText.length);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      displayedLengthRef.current = targetText.length;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      displayedLengthRef.current = targetText.length;
      return;
    }

    let lastTick = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTick;
      if (elapsed >= 16) {
        lastTick = now;
        const currentLen = displayedLengthRef.current;
        const targetLen = targetText.length;

        if (currentLen < targetLen) {
          const diff = targetLen - currentLen;
          let step = 1;
          if (diff > 80) step = 8;
          else if (diff > 40) step = 4;
          else if (diff > 15) step = 2;

          const nextLen = Math.min(targetLen, currentLen + step);
          displayedLengthRef.current = nextLen;
          setDisplayedText(targetText.slice(0, nextLen));
        }
      }

      if (displayedLengthRef.current < targetText.length) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
      }
    };

    if (displayedLengthRef.current < targetText.length) {
      if (animFrameRef.current === null) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [targetText, isStreaming]);

  if (!isStreaming) {
    return targetText;
  }

  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return targetText;
  }

  return displayedText;
}
