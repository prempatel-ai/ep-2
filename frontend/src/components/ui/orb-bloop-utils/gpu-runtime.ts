export interface GpuGateState {
  paused: boolean;
  lowPower: boolean;
}

export interface GpuGate {
  state: GpuGateState;
  frameMs: number;
  dispose: () => void;
}

export function attachGpuGate(canvas: HTMLCanvasElement): GpuGate {
  void canvas;
  const state: GpuGateState = {
    paused: false,
    lowPower: false,
  };

  const handleVisibility = () => {
    state.paused = document.hidden;
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibility);
  }

  return {
    state,
    frameMs: 1000 / 60,
    dispose: () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    },
  };
}

export function deferUntilVisible(
  element: HTMLElement,
  callback: () => void,
): () => void {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
    callback();
    return () => {};
  }

  let executed = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !executed) {
          executed = true;
          observer.disconnect();
          callback();
          break;
        }
      }
    },
    { threshold: 0.05 },
  );

  observer.observe(element);

  return () => {
    observer.disconnect();
  };
}
