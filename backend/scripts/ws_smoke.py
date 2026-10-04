"""Smoke-test the /v1/voice WebSocket endpoint with real audio or text.

Connects to the server, sends an utterance (16 kHz mono PCM16 from a WAV file),
receives transcript, sentence, binary audio frames, and done metrics, and saves
the synthesised WAV files to disk.

Usage:
    python backend/scripts/ws_smoke.py --wav data/tts_samples/mms_en.wav
    python backend/scripts/ws_smoke.py --wav data/tts_samples/mms_en.wav --interrupt
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import sys
import wave
from pathlib import Path
from typing import Any

import websockets

from sahayak.api.serialization import decode_audio_frame

# Ensure UTF-8 output on Windows consoles
if isinstance(sys.stdout, io.TextIOWrapper) and sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if isinstance(sys.stderr, io.TextIOWrapper) and sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def _read_wav_pcm16(path: Path) -> bytes:
    """Read a WAV file and return raw 16 kHz mono 16-bit PCM bytes."""
    with wave.open(str(path), "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        pcm = wf.readframes(n_frames)

    if n_channels != 1:
        raise ValueError(f"Expected mono audio, got {n_channels} channels")
    if sampwidth != 2:
        raise ValueError(f"Expected 16-bit audio (sampwidth=2), got {sampwidth}")
    if framerate != 16_000:
        raise ValueError(f"Expected 16000 Hz, got {framerate} Hz")
    return pcm


async def _run(
    url: str,
    wav_path: Path | None,
    text: str | None,
    language: str | None,
    out_dir: Path,
    interrupt_ms: float | None,
) -> int:
    print(f"Connecting to {url} ...")

    async with websockets.connect(url) as ws:
        # 1. Expect initial ready payload from server
        first_msg = await ws.recv()
        if isinstance(first_msg, str):
            ready_data = json.loads(first_msg)
            print(f"[RECV ready] {ready_data}")
            if ready_data.get("type") != "ready":
                print(f"Expected 'ready', got: {first_msg}", file=sys.stderr)
                return 1
            if not ready_data.get("voice"):
                print("Warning: server reports voice is NOT available!", file=sys.stderr)
        else:
            print("Expected text ready frame, got binary", file=sys.stderr)
            return 1

        # 2. Optional start message to fix language
        if language:
            start_payload = {"type": "start", "language": language}
            print(f"[SEND start] {start_payload}")
            await ws.send(json.dumps(start_payload))
            # receive second ready payload confirmation
            ack = await ws.recv()
            if isinstance(ack, str):
                print(f"[RECV start-ack] {ack}")

        # 3. Send utterance: either binary audio or text
        if wav_path:
            pcm = _read_wav_pcm16(wav_path)
            duration_s = len(pcm) / (16_000 * 2)
            print(f"[SEND audio] {wav_path} ({duration_s:.2f}s, {len(pcm)} bytes PCM16)")
            await ws.send(pcm)
        elif text:
            text_payload = {"type": "text", "text": text, "speak": True}
            print(f"[SEND text] {text_payload}")
            await ws.send(json.dumps(text_payload))
        else:
            print("Error: must provide either --wav or --text", file=sys.stderr)
            return 1

        # Handle optional interrupt
        interrupt_task = None
        if interrupt_ms is not None:

            async def _send_interrupt() -> None:
                await asyncio.sleep(interrupt_ms / 1000.0)
                print(f"\n[SEND interrupt after {interrupt_ms:.0f}ms]")
                await ws.send(json.dumps({"type": "interrupt"}))

            interrupt_task = asyncio.create_task(_send_interrupt())

        # 4. Receive loop
        received_done = False
        saved_audio_count = 0
        done_metrics: dict[str, Any] = {}

        try:
            while True:
                msg = await ws.recv()
                if isinstance(msg, bytes):
                    sentence_idx, wav_bytes = decode_audio_frame(msg)
                    saved_path = out_dir / f"reply_sentence_{sentence_idx}.wav"
                    saved_path.write_bytes(wav_bytes)
                    saved_audio_count += 1
                    print(
                        f"[RECV binary audio] Sentence {sentence_idx}: "
                        f"{len(wav_bytes)} bytes WAV -> {saved_path}"
                    )
                else:
                    payload = json.loads(msg)
                    msg_type = payload.get("type")
                    print(f"[RECV {msg_type}] {payload}")

                    if msg_type == "done":
                        received_done = True
                        done_metrics = payload.get("metrics", {})
                        break
                    elif msg_type == "interrupted":
                        print("Turn was successfully interrupted by client.")
                        break
                    elif msg_type == "no_speech":
                        print("Server reported no speech in audio.")
                        break
                    elif msg_type == "error":
                        print(f"Server error: {payload}", file=sys.stderr)
                        return 1
        finally:
            if interrupt_task and not interrupt_task.done():
                interrupt_task.cancel()

        print("\n--- Summary ---")
        if received_done:
            print("Turn completed successfully.")
            print(f"Saved audio clips: {saved_audio_count}")
            print("Metrics:")
            for k, v in done_metrics.items():
                print(f"  {k}: {v}")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test /v1/voice WebSocket endpoint.")
    parser.add_argument(
        "--url",
        type=str,
        default="ws://127.0.0.1:8000/v1/voice",
        help="WebSocket URL",
    )
    parser.add_argument(
        "--wav",
        type=Path,
        default=None,
        help="Path to 16 kHz mono WAV file to send",
    )
    parser.add_argument(
        "--text",
        type=str,
        default=None,
        help="Text message to send instead of audio",
    )
    parser.add_argument(
        "--language",
        type=str,
        default=None,
        choices=["en", "hi", "gu"],
        help="Language code",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("data/ws_smoke_out"),
        help="Directory to save received WAV audio frames",
    )
    parser.add_argument(
        "--interrupt",
        dest="interrupt_ms",
        nargs="?",
        const=300.0,
        type=float,
        default=None,
        help="Send interrupt message after N milliseconds (default 300ms)",
    )
    args = parser.parse_args()

    if not args.wav and not args.text:
        # Default to the english sample generated by tts_listen
        default_sample = Path("data/tts_samples/mms_en.wav")
        if default_sample.exists():
            args.wav = default_sample
        else:
            parser.error("Either --wav or --text must be specified.")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    sys.exit(
        asyncio.run(
            _run(
                url=args.url,
                wav_path=args.wav,
                text=args.text,
                language=args.language,
                out_dir=args.out_dir,
                interrupt_ms=args.interrupt_ms,
            )
        )
    )


if __name__ == "__main__":
    main()
