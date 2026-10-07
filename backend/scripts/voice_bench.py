#!/usr/bin/env python3
"""Voice benchmark runner for Sahayak Voice v2 (Phase 11).

Measures latency per stage across languages on a repeatable clip set:
- Connects to WebSocket /v1/voice
- Sends 16 kHz mono PCM16 audio clips
- Collects per-stage timing metrics (STT, first sentence, first audio, total)
- Computes p50 and p95 across repeated runs
- Writes structured JSON results to backend/data/bench/

Developer-eyes-only diagnostic tool. Never logs or commits user audio.
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import platform
import sys
import time
import wave
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# Ensure UTF-8 output on Windows consoles
if isinstance(sys.stdout, io.TextIOWrapper) and sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if isinstance(sys.stderr, io.TextIOWrapper) and sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    import websockets
except ImportError:
    websockets = None  # Handled in main()


@dataclass
class ClipItem:
    path: Path
    language: str
    reference_transcript: str | None


@dataclass
class TurnMeasurement:
    clip_name: str
    language: str
    audio_duration_s: float
    stt_ms: float | None
    first_sentence_ms: float | None
    first_audio_ms: float | None
    total_ms: float
    client_total_ms: float
    transcript: str
    reference_transcript: str | None
    source: str | None


def read_wav_pcm16(path: Path) -> tuple[bytes, float]:
    """Read a WAV file and return raw 16 kHz mono 16-bit PCM bytes and duration in seconds."""
    with wave.open(str(path), "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        pcm = wf.readframes(n_frames)

    if n_channels != 1:
        raise ValueError(f"Expected mono audio, got {n_channels} channels in {path.name}")
    if sampwidth != 2:
        raise ValueError(f"Expected 16-bit audio (sampwidth=2), got {sampwidth} in {path.name}")
    if framerate != 16_000:
        raise ValueError(f"Expected 16000 Hz, got {framerate} Hz in {path.name}")

    duration_s = n_frames / framerate
    return pcm, duration_s


def discover_clips(clips_dir: Path) -> list[ClipItem]:
    """Find all WAV clips in clips_dir, resolving language and reference transcripts."""
    if not clips_dir.is_dir():
        return []

    items: list[ClipItem] = []
    # Support language subdirectories: clips_dir/gu/*.wav, clips_dir/hi/*.wav, clips_dir/en/*.wav
    for lang in ["gu", "hi", "en"]:
        lang_dir = clips_dir / lang
        if lang_dir.is_dir():
            for wav in sorted(lang_dir.glob("*.wav")):
                ref_txt = wav.with_suffix(".txt")
                ref_content = (
                    ref_txt.read_text(encoding="utf-8").strip() if ref_txt.is_file() else None
                )
                items.append(ClipItem(path=wav, language=lang, reference_transcript=ref_content))

    # Also support root level clips named like *_gu.wav, *_hi.wav, *_en.wav
    for wav in sorted(clips_dir.glob("*.wav")):
        name_lower = wav.stem.lower()
        matched_lang = None
        for lang_code in ["gu", "hi", "en"]:
            if name_lower.endswith(f"_{lang_code}") or f"_{lang_code}_" in name_lower:
                matched_lang = lang_code
                break
        if matched_lang:
            ref_txt = wav.with_suffix(".txt")
            ref_content = (
                ref_txt.read_text(encoding="utf-8").strip() if ref_txt.is_file() else None
            )
            items.append(
                ClipItem(path=wav, language=matched_lang, reference_transcript=ref_content)
            )

    return items


async def run_single_turn(
    url: str,
    pcm: bytes,
    duration_s: float,
    language: str,
    clip_name: str,
    reference_transcript: str | None,
) -> TurnMeasurement:
    """Send one clip through the WebSocket and measure timestamps."""
    async with websockets.connect(url) as ws:
        # 1. Expect initial ready payload
        first_raw = await ws.recv()
        if not isinstance(first_raw, str):
            raise RuntimeError(f"Expected JSON ready payload, got binary: {first_raw!r}")
        ready_payload = json.loads(first_raw)
        if ready_payload.get("type") != "ready":
            raise RuntimeError(f"Expected 'ready' type, got: {ready_payload}")

        # 2. Send start message to set language
        await ws.send(json.dumps({"type": "start", "language": language}))
        ack_raw = await ws.recv()
        if not isinstance(ack_raw, str):
            raise RuntimeError(f"Expected JSON ready confirmation, got binary: {ack_raw!r}")

        # 3. Send audio utterance
        t_sent = time.perf_counter()
        await ws.send(pcm)

        # 4. Listen for events
        transcript = ""
        stt_ms: float | None = None
        first_sentence_ms: float | None = None
        first_audio_ms: float | None = None
        server_total_ms: float = 0.0
        source: str | None = None

        while True:
            msg = await ws.recv()
            t_now = time.perf_counter()
            if isinstance(msg, str):
                data = json.loads(msg)
                msg_type = data.get("type")
                if msg_type == "transcript":
                    transcript = data.get("text", "")
                elif msg_type == "sentence":
                    if first_sentence_ms is None:
                        first_sentence_ms = (t_now - t_sent) * 1000.0
                    source = data.get("source")
                elif msg_type == "done":
                    client_total_ms = (t_now - t_sent) * 1000.0
                    metrics = data.get("metrics") or {}
                    stt_ms = metrics.get("stt_ms")
                    if metrics.get("first_sentence_ms") is not None:
                        first_sentence_ms = metrics.get("first_sentence_ms")
                    if metrics.get("first_audio_ms") is not None:
                        first_audio_ms = metrics.get("first_audio_ms")
                    server_total_ms = metrics.get("total_ms", client_total_ms)
                    source = data.get("source", source)
                    break
                elif msg_type == "error":
                    code = data.get("code")
                    message = data.get("message")
                    raise RuntimeError(f"Server returned error [{code}]: {message}")
                elif msg_type == "no_speech":
                    client_total_ms = (t_now - t_sent) * 1000.0
                    return TurnMeasurement(
                        clip_name=clip_name,
                        language=language,
                        audio_duration_s=duration_s,
                        stt_ms=None,
                        first_sentence_ms=None,
                        first_audio_ms=None,
                        total_ms=client_total_ms,
                        client_total_ms=client_total_ms,
                        transcript="[NO_SPEECH]",
                        reference_transcript=reference_transcript,
                        source="no_speech",
                    )
            elif isinstance(msg, bytes):
                if first_audio_ms is None:
                    first_audio_ms = (t_now - t_sent) * 1000.0

        return TurnMeasurement(
            clip_name=clip_name,
            language=language,
            audio_duration_s=duration_s,
            stt_ms=stt_ms,
            first_sentence_ms=first_sentence_ms,
            first_audio_ms=first_audio_ms,
            total_ms=server_total_ms,
            client_total_ms=client_total_ms,
            transcript=transcript,
            reference_transcript=reference_transcript,
            source=source,
        )


def percentile(values: list[float], p: float) -> float:
    """Calculate the p-th percentile from a list of floats (0 to 100)."""
    if not values:
        return 0.0
    sorted_v = sorted(values)
    k = (len(sorted_v) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(sorted_v) - 1)
    d = k - f
    return sorted_v[f] + (sorted_v[c] - sorted_v[f]) * d


async def main_async(args: argparse.Namespace) -> int:
    clips_dir = Path(args.clips_dir)
    output_dir = Path(args.output_dir)

    print("=" * 74)
    print(" Sahayak Voice v2 Latency and Stage Benchmark (voice_bench.py)")
    print("=" * 74)

    clips = discover_clips(clips_dir)
    if not clips:
        print(f"\n[INFO] No test audio clips found in '{clips_dir}'.")
        print("\nTo benchmark voice latency and accuracy, supply 5 to 10 clips per language:")
        print(f"  {clips_dir / 'gu'}/*.wav")
        print(f"  {clips_dir / 'hi'}/*.wav")
        print(f"  {clips_dir / 'en'}/*.wav")
        print("\nRequired format for each clip:")
        print("  - Container: WAV (RIFF)")
        print("  - Audio format: 16 kHz mono signed 16-bit PCM")
        print("  - Reference transcripts: One .txt file alongside each .wav (e.g. clip01.txt)")
        print("  - Variety: 5 to 10 clips per language with short asks and natural pauses.")
        print("-" * 74)
        print("Status: UNVERIFIED (Awaiting human-supplied test clips)")
        print("=" * 74)
        return 0

    print(f"Found {len(clips)} test clips across {[c.language for c in clips]}.")
    print(f"Endpoint: {args.url}")
    print(f"Repetitions per clip: {args.repeats}")
    print("-" * 74)

    # Preload and validate PCM audio
    clip_pcm_map: dict[str, tuple[bytes, float]] = {}
    for clip in clips:
        try:
            pcm, dur = read_wav_pcm16(clip.path)
            clip_pcm_map[str(clip.path)] = (pcm, dur)
        except Exception as exc:
            print(f"Error loading {clip.path.name}: {exc}", file=sys.stderr)
            return 1

    all_measurements: list[TurnMeasurement] = []

    for r in range(1, args.repeats + 1):
        print(f"\n--- Benchmark Run {r}/{args.repeats} ---")
        for clip in clips:
            pcm, dur = clip_pcm_map[str(clip.path)]
            try:
                m = await run_single_turn(
                    url=args.url,
                    pcm=pcm,
                    duration_s=dur,
                    language=clip.language,
                    clip_name=clip.path.name,
                    reference_transcript=clip.reference_transcript,
                )
                all_measurements.append(m)
                stt_str = f"{m.stt_ms:.0f}ms" if m.stt_ms is not None else "-"
                fa_str = f"{m.first_audio_ms:.0f}ms" if m.first_audio_ms is not None else "-"
                print(
                    f"  [{clip.language}] {clip.path.name} ({dur:.2f}s): "
                    f"STT={stt_str}, 1stAudio={fa_str}, Total={m.total_ms:.0f}ms, Source={m.source}"
                )
            except Exception as exc:
                print(f"  [ERROR] {clip.path.name}: {exc}", file=sys.stderr)
                return 1

    # Summarize per language
    print("\n" + "=" * 74)
    print(" Benchmark Summary: p50 and p95 Latencies per Stage")
    print("=" * 74)
    hdr = (
        f"{'Language':<10} {'Runs':<6} {'STT p50/p95 (ms)':<20} "
        f"{'1st Audio p50/p95 (ms)':<24} {'Total p50/p95 (ms)':<20}"
    )
    print(hdr)
    print("-" * 74)

    summary_by_lang: dict[str, Any] = {}
    for lang in ["gu", "hi", "en"]:
        lang_runs = [m for m in all_measurements if m.language == lang]
        if not lang_runs:
            continue
        stt_vals = [m.stt_ms for m in lang_runs if m.stt_ms is not None]
        fa_vals = [m.first_audio_ms for m in lang_runs if m.first_audio_ms is not None]
        tot_vals = [m.total_ms for m in lang_runs]

        stt_p50 = percentile(stt_vals, 50) if stt_vals else 0.0
        stt_p95 = percentile(stt_vals, 95) if stt_vals else 0.0
        fa_p50 = percentile(fa_vals, 50) if fa_vals else 0.0
        fa_p95 = percentile(fa_vals, 95) if fa_vals else 0.0
        tot_p50 = percentile(tot_vals, 50)
        tot_p95 = percentile(tot_vals, 95)

        stt_col = f"{stt_p50:.0f} / {stt_p95:.0f}"
        fa_col = f"{fa_p50:.0f} / {fa_p95:.0f}"
        tot_col = f"{tot_p50:.0f} / {tot_p95:.0f}"
        print(f"{lang:<10} {len(lang_runs):<6} {stt_col:<20} {fa_col:<24} {tot_col:<20}")

        summary_by_lang[lang] = {
            "runs_count": len(lang_runs),
            "stt_p50_ms": stt_p50,
            "stt_p95_ms": stt_p95,
            "first_audio_p50_ms": fa_p50,
            "first_audio_p95_ms": fa_p95,
            "total_p50_ms": tot_p50,
            "total_p95_ms": tot_p95,
        }

    print("-" * 74)
    target_first_audio_ms = 4000.0  # product.md target: first audio <= 4.0s on CPU
    for lang, s in summary_by_lang.items():
        status = "MET" if s["first_audio_p50_ms"] <= target_first_audio_ms else "NOT MET"
        p50_val = s["first_audio_p50_ms"]
        print(
            f"Target check [{lang}]: p50 first audio = {p50_val:.0f} ms vs <= 4000 ms -> {status}"
        )
    print("=" * 74)

    # Save to JSON
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    out_file = output_dir / f"voice_bench_{ts}.json"
    bench_data = {
        "timestamp_utc": datetime.now(UTC).isoformat(),
        "hardware": {
            "machine": platform.machine(),
            "processor": platform.processor(),
            "system": platform.system(),
            "python": sys.version,
        },
        "target_first_audio_ms": target_first_audio_ms,
        "repeats": args.repeats,
        "summary_by_language": summary_by_lang,
        "measurements": [asdict(m) for m in all_measurements],
    }
    out_file.write_text(json.dumps(bench_data, indent=2), encoding="utf-8")
    print(f"\nSaved benchmark results to {out_file}")

    return 0


def main() -> int:
    if websockets is None:
        err_msg = "Error: 'websockets' is required. Install via pip install websockets"
        print(err_msg, file=sys.stderr)
        return 1

    parser = argparse.ArgumentParser(description="Sahayak Voice Benchmark (Phase 11)")
    parser.add_argument(
        "--clips-dir",
        default="backend/eval/voice_clips",
        help="Directory containing human-supplied WAV test clips",
    )
    parser.add_argument(
        "--output-dir",
        default="backend/data/bench",
        help="Directory to save JSON benchmark runs (default: backend/data/bench)",
    )
    parser.add_argument(
        "--url",
        default="ws://127.0.0.1:8000/v1/voice",
        help="WebSocket URL (default: ws://127.0.0.1:8000/v1/voice)",
    )
    parser.add_argument(
        "--repeats",
        type=int,
        default=3,
        help="Number of times to benchmark each clip (default: 3)",
    )
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
