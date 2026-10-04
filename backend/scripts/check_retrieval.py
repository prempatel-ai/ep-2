"""Developer inspection tool: retrieve top hits for a list of queries.

Usage:
    python backend/scripts/check_retrieval.py <queries_file> [--top-k K]

Output is for developer eyes only.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from sahayak.config import Settings
from sahayak.container import build_embedder, build_faq_index


def _load_queries(queries_path: Path) -> list[str] | None:
    """Return non-blank, non-comment lines, or None on error."""
    if not queries_path.exists():
        print(f"Error: queries file not found: {queries_path}", file=sys.stderr)
        return None
    return [
        line.strip()
        for line in queries_path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


async def _run(queries_path: Path, top_k: int) -> int:
    queries = _load_queries(queries_path)
    if queries is None:
        return 1
    if not queries:
        print("No queries found in file.", file=sys.stderr)
        return 0

    settings = Settings()
    embedder = build_embedder(settings)
    index = build_faq_index(settings, embedder)

    await embedder.load()
    await index.load()

    total_faqs = await index.size()
    print(f"FAQ Index entries: {total_faqs}")
    print(f"Checking {len(queries)} queries (top_k={top_k})...\n")

    for i, q in enumerate(queries, start=1):
        print(f"[{i}] Query: {q}")
        hits = await index.search(q, limit=top_k)
        if not hits:
            print("    (no hits found)")
        for rank, hit in enumerate(hits, start=1):
            print(f"    {rank}. [score={hit.score:.4f}] Q: {hit.question}")
            print(f"       A: {hit.answer}")
        print()

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Check retrieval hits for queries.")
    parser.add_argument("queries_file", type=Path, help="Path to text file with one query per line")
    parser.add_argument("--top-k", type=int, default=3, help="Number of hits per query")
    args = parser.parse_args()

    sys.exit(asyncio.run(_run(args.queries_file, args.top_k)))


if __name__ == "__main__":
    main()
