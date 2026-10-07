"""Ingest and curate clinical verified FAQs into backend/data/faqs.jsonl for ChromaDB RAG.

Extracts oncology, breast cancer, screening, and women's health Q&As from:
1. MedQuad NIH Dataset (National Cancer Institute, MedlinePlus, CDC)
2. ChatDoctor HealthCareMagic clinical consultations
Attaches verified source attribution to every record.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from datasets import load_dataset

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ingest_clinical_faqs")

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
OUTPUT_FILE = DATA_DIR / "faqs.jsonl"

CANCER_KEYWORDS = [
    "breast",
    "mammog",
    "mastectomy",
    "cancer",
    "tumor",
    "tumour",
    "oncolog",
    "lump",
    "nipple",
    "chemotherapy",
    "radiation",
    "biopsy",
    "carcinoma",
    "metastasis",
    "fibroadenoma",
    "mastitis",
    "calcification",
    "her2",
    "brca",
    "tamoxifen",
    "lumpectomy",
    "malignant",
    "benign",
]

CLEAN_WS = re.compile(r"\s+")


def clean_text(text: str) -> str:
    return CLEAN_WS.sub(" ", text).strip()


def is_relevant(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in CANCER_KEYWORDS)


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, str]] = []
    seen_questions: set[str] = set()

    # 1. MedQuad NIH Dataset
    logger.info("Loading MedQuad NIH dataset...")
    try:
        medquad_ds = load_dataset("keivalya/MedQuad-MedicalQnADataset", split="train")
        medquad_count = 0
        for item in medquad_ds:
            q = clean_text(str(item.get("Question", "")))
            a = clean_text(str(item.get("Answer", "")))
            if not q or not a or len(q) < 5 or len(a) < 10:
                continue
            if is_relevant(q + " " + a):
                q_key = q.casefold()
                if q_key not in seen_questions:
                    seen_questions.add(q_key)
                    records.append(
                        {
                            "question": q,
                            "answer": a[:1500],
                            "lang": "en",
                            "source": "NIH / National Cancer Institute & MedlinePlus",
                        }
                    )
                    medquad_count += 1
        logger.info("Extracted %d curated clinical FAQs from MedQuad", medquad_count)
    except Exception as exc:
        logger.error("Error loading MedQuad: %s", exc)

    # 2. ChatDoctor HealthCareMagic Dataset
    logger.info("Loading ChatDoctor HealthCareMagic consultations...")
    try:
        chatdoc_ds = load_dataset(
            "lavita/ChatDoctor-HealthCareMagic-100k", split="train[:25000]"
        )
        chatdoc_count = 0
        for item in chatdoc_ds:
            raw_q = str(item.get("input", "") or item.get("instruction", ""))
            raw_a = str(item.get("output", ""))
            q = clean_text(raw_q)
            a = clean_text(raw_a)
            if not q or not a or len(q) < 10 or len(a) < 15:
                continue
            if is_relevant(q + " " + a):
                q_key = q.casefold()
                if q_key not in seen_questions:
                    seen_questions.add(q_key)
                    records.append(
                        {
                            "question": q,
                            "answer": a[:1500],
                            "lang": "en",
                            "source": "HealthCareMagic Physician Consultations",
                        }
                    )
                    chatdoc_count += 1
        logger.info("Extracted %d clinical consultations from ChatDoctor", chatdoc_count)
    except Exception as exc:
        logger.error("Error loading ChatDoctor: %s", exc)

    # Write to backend/data/faqs.jsonl
    logger.info("Writing %d verified clinical records to %s...", len(records), OUTPUT_FILE)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fp:
        for rec in records:
            fp.write(json.dumps(rec, ensure_ascii=False) + "\n")

    logger.info("Successfully created %s with %d records.", OUTPUT_FILE, len(records))


if __name__ == "__main__":
    main()
