"""Build the FAQ search index:  sahayak-index [--faq PATH]"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from sahayak.config import Settings
from sahayak.container import build_embedder, build_faq_index
from sahayak.errors import SahayakError
from sahayak.services.faq_loader import load_faq_entries


async def _run(faq_path: Path, settings: Settings) -> int:
    entries, report = load_faq_entries(faq_path)
    print(f"Read {report.lines_read} records from {faq_path}")
    print(f"  usable: {report.loaded}  duplicates dropped: {report.duplicates}")
    if report.conflicts:
        print(
            f"  WARNING: {len(report.conflicts)} questions repeat with a different answer "
            f"(first kept). Lines: {report.conflicts[:10]}"
        )
    for line_no, reason in report.invalid[:10]:
        print(f"  skipped line {line_no}: {reason}")
    if len(report.invalid) > 10:
        print(f"  ... and {len(report.invalid) - 10} more skipped lines")

    embedder = build_embedder(settings)
    index = build_faq_index(settings, embedder)
    await embedder.load()
    await index.load()
    await index.rebuild(
        entries,
        on_progress=lambda done, total: print(f"\r  indexed {done}/{total}", end="", flush=True),
    )
    print(f"\nDone. Index stored in {settings.retrieval.persist_dir}")
    return 0


def main() -> None:
    settings = Settings()
    parser = argparse.ArgumentParser(description="Build the FAQ retrieval index.")
    parser.add_argument("--faq", type=Path, default=settings.retrieval.faq_path)
    args = parser.parse_args()
    try:
        sys.exit(asyncio.run(_run(args.faq, settings)))
    except SahayakError as exc:
        print(f"error: {exc.message}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
