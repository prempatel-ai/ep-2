import { useEffect, useRef } from "react";

export interface OrbAudioAnalyzer {
  allAvg: number;
  lowAvg: number;
  midAvg: number;
  highAvg: number;
  update: () => void;
  dispose: () => void;
}

export function useCorsAudioSrc(src: string): string {
  return src;
}

export function useOrbAudio(
  audioMode: "ambient" | "mic" | "file",
  audioElement?: React.RefObject<HTMLAudioElement | null>,
  audioSrc?: string,
): React.MutableRefObject<OrbAudioAnalyzer | null> {
  void audioSrc;
  const analyzerRef = useRef<OrbAudioAnalyzer | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let audioCtx: AudioContext | null = null;
    let analyzer: AnalyserNode | null = null;
    let sourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
    let stream: MediaStream | null = null;

    const dataArray = new Uint8Array(64);

    const setupAnalyzer = (source: AudioNode, ctx: AudioContext) => {
      analyzer = ctx.createAnalyser();
      analyzer.fftSize = 128;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);
      // Do not connect mic to destination to avoid feedback loop!
      if (audioMode === "file") {
        analyzer.connect(ctx.destination);
      }

      analyzerRef.current = {
        allAvg: 0,
        lowAvg: 0,
        midAvg: 0,
        highAvg: 0,
        update: () => {
          if (!analyzer) return;
          analyzer.getByteFrequencyData(dataArray);
          let sum = 0;
          let lowSum = 0;
          let midSum = 0;
          let highSum = 0;

          for (let i = 0; i < 64; i++) {
            const val = dataArray[i];
            sum += val;
            if (i < 16) lowSum += val;
            else if (i < 40) midSum += val;
            else highSum += val;
          }

          analyzerRef.current!.allAvg = sum / 64;
          analyzerRef.current!.lowAvg = lowSum / 16;
          analyzerRef.current!.midAvg = midSum / 24;
          analyzerRef.current!.highAvg = highSum / 24;
        },
        dispose: () => {
          try {
            audioCtx?.close();
          } catch {
            // ignore
          }
        },
      };
    };

    if (audioMode === "mic") {
      navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((s) => {
          stream = s;
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          audioCtx = new AudioContextClass();
          sourceNode = audioCtx.createMediaStreamSource(stream);
          setupAnalyzer(sourceNode, audioCtx);
        })
        .catch(() => {
          // Microhone access denied or not available; fallback handled by ambient mode
        });
    } else if (audioMode === "file" && audioElement?.current) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        audioCtx = new AudioContextClass();
        sourceNode = audioCtx.createMediaElementSource(audioElement.current);
        setupAnalyzer(sourceNode, audioCtx);
      } catch {
        // ignore
      }
    }

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      analyzerRef.current?.dispose();
      analyzerRef.current = null;
    };
  }, [audioMode, audioElement]);

  return analyzerRef;
}
