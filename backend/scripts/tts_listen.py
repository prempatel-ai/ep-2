"""Synthesise fixed messages across languages for human listening comparison.

Usage:
    python backend/scripts/tts_listen.py [--backend mms] [--out-dir data/tts_samples]
"""

from __future__ import annotations

import argparse
import asyncio
import io
import sys
import time
from pathlib import Path

# Ensure UTF-8 output on Windows consoles where default may be cp1252
if isinstance(sys.stdout, io.TextIOWrapper) and sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if isinstance(sys.stderr, io.TextIOWrapper) and sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from sahayak.adapters.tts_mms import MMSTTS
from sahayak.domain.language import Language
from sahayak.services.messages import NO_ANSWER

_LANGUAGES: tuple[Language, ...] = (Language.GUJARATI, Language.HINDI, Language.ENGLISH)


async def _run(backend_name: str, out_dir: Path) -> int:
    if backend_name == "mms":
        print("Initializing MMSTTS backend on CPU...")
        t0 = time.perf_counter()
        tts = MMSTTS(device="cpu", languages=_LANGUAGES)
        await tts.load()
        load_time = time.perf_counter() - t0
        print(f"MMSTTS loaded in {load_time:.2f}s\n")
    else:
        print(f"Unsupported backend for tts_listen: {backend_name}", file=sys.stderr)
        return 1

    print(f"Synthesising fixed messages to '{out_dir}':\n")
    for lang in _LANGUAGES:
        text = NO_ANSWER[lang]
        print(f"[{lang.value}] Text: {text}")
        t_start = time.perf_counter()
        clip = await tts.synthesize(text, lang)
        synth_ms = (time.perf_counter() - t_start) * 1000.0

        out_path = out_dir / f"{backend_name}_{lang.value}.wav"
        out_path.write_bytes(clip.to_wav_bytes())

        print(f"       File: {out_path}")
        print(
            f"       Duration: {clip.duration_s:.2f}s | "
            f"Sample Rate: {clip.sample_rate} Hz | "
            f"Synth Time: {synth_ms:.1f}ms (RTF: {synth_ms / (clip.duration_s * 1000.0):.2f})\n"
        )

    print("Done. All audio samples saved.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate TTS samples for comparison.")
    parser.add_argument(
        "--backend",
        type=str,
        default="mms",
        choices=["mms"],
        help="TTS backend to test",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("data/tts_samples"),
        help="Output directory for generated WAV samples",
    )
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    sys.exit(asyncio.run(_run(args.backend, args.out_dir)))


if __name__ == "__main__":
    main()
