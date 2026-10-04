"""Evaluate retrieval score distributions and threshold sweeps on a probe set.

Usage:
    python backend/scripts/tune_thresholds.py [--probes PATH]

Input probe format (JSON Lines):
    {"query": "...", "expected_question": "..."}
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from sahayak.config import Settings
from sahayak.container import build_embedder, build_faq_index


def _load_probes(probes_path: Path) -> list[dict[str, str]] | None:
    """Read JSONL probes file and return valid probe dicts, or None on error."""
    if not probes_path.exists():
        print(f"Error: probes file not found: {probes_path}", file=sys.stderr)
        return None
    raw = probes_path.read_text(encoding="utf-8").splitlines()
    lines = [line.strip() for line in raw if line.strip()]
    probes: list[dict[str, str]] = []
    for line_no, line in enumerate(lines, start=1):
        try:
            data = json.loads(line)
            if "query" in data and "expected_question" in data:
                probes.append(data)
            else:
                print(
                    f"Warning: line {line_no} missing 'query' or 'expected_question'",
                    file=sys.stderr,
                )
        except json.JSONDecodeError:
            print(f"Warning: line {line_no} invalid JSON", file=sys.stderr)
    return probes


async def _run(probes_path: Path) -> int:
    probes = _load_probes(probes_path)
    if probes is None:
        return 1
    if not probes:
        print("No valid probes found.", file=sys.stderr)
        return 1

    settings = Settings()
    embedder = build_embedder(settings)
    index = build_faq_index(settings, embedder)

    await embedder.load()
    await index.load()

    correct_scores: list[float] = []
    incorrect_scores: list[float] = []
    results: list[tuple[float, bool]] = []

    print(f"Running retrieval on {len(probes)} probes...\n")
    for probe in probes:
        query = probe["query"]
        expected = probe["expected_question"].strip().casefold()
        hits = await index.search(query, limit=1)
        if not hits:
            incorrect_scores.append(0.0)
            results.append((0.0, False))
            continue
        top_hit = hits[0]
        score = top_hit.score
        is_correct = top_hit.question.strip().casefold() == expected
        if is_correct:
            correct_scores.append(score)
        else:
            incorrect_scores.append(score)
        results.append((score, is_correct))

    # (a) Score distribution of correct vs incorrect top hits
    print("--- (a) Score Distribution of Top Hits ---")
    if correct_scores:
        n = len(correct_scores)
        mn = min(correct_scores)
        mean = sum(correct_scores) / n
        mx = max(correct_scores)
        print(f"Correct top hits   (n={n}): min={mn:.4f}, mean={mean:.4f}, max={mx:.4f}")
    else:
        print("Correct top hits   (n=0): none")

    if incorrect_scores:
        n = len(incorrect_scores)
        mn = min(incorrect_scores)
        mean = sum(incorrect_scores) / n
        mx = max(incorrect_scores)
        print(f"Incorrect top hits (n={n}): min={mn:.4f}, mean={mean:.4f}, max={mx:.4f}")
    else:
        print("Incorrect top hits (n=0): none")

    # (b) Threshold sweep 0.80 to 0.98 in steps of 0.02
    print("\n--- (b) Verbatim Answer Threshold Sweep (0.80 - 0.98) ---")
    hdr = (
        f"{'Threshold':<10} | {'Answered Verbatim':<18} | "
        f"{'Correct Fraction':<16} | {'Coverage':<10}"
    )
    print(hdr)
    print("-" * 62)
    thresholds = [round(0.80 + i * 0.02, 2) for i in range(10)]
    total_probes = len(probes)

    for th in thresholds:
        verbatim_items = [is_corr for score, is_corr in results if score >= th]
        answered_count = len(verbatim_items)
        if answered_count > 0:
            correct_fraction = sum(verbatim_items) / answered_count
            correct_pct = f"{correct_fraction * 100:.1f}%"
        else:
            correct_pct = "N/A (0)"
        coverage = f"{answered_count / total_probes * 100:.1f}%"
        print(f"{th:<10.2f} | {answered_count:<18} | {correct_pct:<16} | {coverage:<10}")

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Tune retrieval thresholds on probe set.")
    parser.add_argument(
        "--probes",
        type=Path,
        default=Path("eval/retrieval_probes.example.jsonl"),
        help="Path to JSONL probes file",
    )
    args = parser.parse_args()

    sys.exit(asyncio.run(_run(args.probes)))


if __name__ == "__main__":
    main()
