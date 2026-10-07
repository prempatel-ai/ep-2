#!/usr/bin/env python3
"""One-time offline model preparation script for Sahayak.

Run this script ONCE while connected to the internet to pre-download
all required model weights into the local HuggingFace cache:
  1. Multilingual-e5-small (Embeddings / RAG)
  2. Faster-Whisper small (Speech-to-text)
  3. Meta MMS-TTS (Gujarati, Hindi, English Text-to-speech)

After running this script, you can disconnect the network and set:
  HF_HUB_OFFLINE=1
  TRANSFORMERS_OFFLINE=1
"""

from __future__ import annotations

import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("download_models")


def download_e5() -> bool:
    logger.info("1/3 Downloading embedding model: intfloat/multilingual-e5-small...")
    try:
        from sentence_transformers import SentenceTransformer

        SentenceTransformer("intfloat/multilingual-e5-small")
        logger.info(" -> E5 embedding model cached successfully.")
        return True
    except ImportError:
        logger.warning("sentence-transformers not installed; skipping E5 download.")
        return False
    except Exception as exc:
        logger.error("Failed to download E5 embedding model: %s", exc)
        return False


def download_whisper() -> bool:
    logger.info("2/3 Downloading Whisper STT model: Systran/faster-whisper-small...")
    try:
        from faster_whisper import download_model

        download_model("small")
        logger.info(" -> Faster-Whisper small model cached successfully.")
        return True
    except ImportError:
        logger.warning("faster-whisper not installed; skipping Whisper download.")
        return False
    except Exception as exc:
        logger.error("Failed to download Whisper model: %s", exc)
        return False


def download_mms() -> bool:
    logger.info("3/3 Downloading MMS TTS models (gu, hi, en)...")
    try:
        from transformers import AutoTokenizer, VitsModel

        models = [
            "facebook/mms-tts-guj",
            "facebook/mms-tts-hin",
            "facebook/mms-tts-eng",
        ]
        for repo_id in models:
            logger.info("  Downloading %s...", repo_id)
            AutoTokenizer.from_pretrained(repo_id)
            VitsModel.from_pretrained(repo_id)
        logger.info(" -> MMS-TTS models cached successfully.")
        return True
    except ImportError:
        logger.warning("transformers not installed; skipping MMS download.")
        return False
    except Exception as exc:
        logger.error("Failed to download MMS models: %s", exc)
        return False


def main() -> None:
    logger.info("=== Sahayak Offline Model Download ===")
    s1 = download_e5()
    s2 = download_whisper()
    s3 = download_mms()
    logger.info("=== Download Summary ===")
    logger.info("Embeddings (E5): %s", "CACHED" if s1 else "SKIPPED/FAILED")
    logger.info("STT (Whisper):   %s", "CACHED" if s2 else "SKIPPED/FAILED")
    logger.info("TTS (MMS):       %s", "CACHED" if s3 else "SKIPPED/FAILED")
    if s1 and s2 and s3:
        logger.info("All offline models ready. You can now enable HF_HUB_OFFLINE=1.")
    else:
        logger.info("Some models were skipped. Install missing optional dependencies and re-run.")


if __name__ == "__main__":
    main()
