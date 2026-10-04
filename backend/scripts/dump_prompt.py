"""Dump exact prompt layouts produced by PromptBuilder for fine-tuning handoff.

Prints the message lists for Gujarati, Hindi, and English, both with and without
retrieved FAQ context reference blocks.

Usage:
    python backend/scripts/dump_prompt.py
"""

from __future__ import annotations

import io
import sys

from sahayak.config import RESOURCES_DIR
from sahayak.domain.language import Language
from sahayak.domain.models import FAQHit
from sahayak.services.prompting import PromptBuilder

# Ensure UTF-8 output on Windows consoles
if isinstance(sys.stdout, io.TextIOWrapper) and sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_SAMPLE_QUESTIONS = {
    Language.GUJARATI: "મેમોગ્રાફી શું છે?",
    Language.HINDI: "मैमोग्राफी क्या है?",
    Language.ENGLISH: "What is a mammogram?",
}

_SAMPLE_FAQ_HITS = {
    Language.GUJARATI: FAQHit(
        question="મેમોગ્રાફી એટલે શું?",
        answer="મેમોગ્રાફી એ સ્તનની એક્સ-રે તપાસ છે જે કેન્સરના પ્રારંભિક લક્ષણો શોધવામાં મદદ કરે છે.",
        score=0.92,
    ),
    Language.HINDI: FAQHit(
        question="मैमोग्राफी क्या होती है?",
        answer="मैमोग्राफी स्तन का एक्स-रे परीक्षण है जो शुरुआती लक्षणों का पता लगाने में मदद करता है।",
        score=0.92,
    ),
    Language.ENGLISH: FAQHit(
        question="What is a mammogram?",
        answer=(
            "A mammogram is a low-dose X-ray picture of the breast used to detect early signs "
            "of cancer."
        ),
        score=0.92,
    ),
}


def main() -> None:
    prompt_file = RESOURCES_DIR / "system_prompt.txt"
    builder = PromptBuilder.from_file(prompt_file)

    print("=" * 80)
    print("PROMPT LAYOUT DUMP FOR FINE-TUNING HANDOFF")
    print(f"Source system prompt: {prompt_file}")
    print("=" * 80 + "\n")

    for lang in (Language.GUJARATI, Language.HINDI, Language.ENGLISH):
        print("-" * 80)
        print(f"LANGUAGE: {lang.name} ({lang.english_name})")
        print("-" * 80 + "\n")

        # 1. Without reference block (Decision D3: option A)
        print("### [Case A] Without Reference Block (Context Mode Disabled / Score < threshold)")
        messages_no_ctx = builder.build(
            user_text=_SAMPLE_QUESTIONS[lang],
            language=lang,
            context=(),
        )
        for i, msg in enumerate(messages_no_ctx):
            print(f"Message [{i}] role={msg.role!r}:")
            for line in msg.content.splitlines():
                print(f"  | {line}")
        print()

        # 2. With reference block (Decision D3: option B)
        print("### [Case B] With Reference Block (Context Mode Enabled)")
        messages_with_ctx = builder.build(
            user_text=_SAMPLE_QUESTIONS[lang],
            language=lang,
            context=(_SAMPLE_FAQ_HITS[lang],),
        )
        for i, msg in enumerate(messages_with_ctx):
            print(f"Message [{i}] role={msg.role!r}:")
            for line in msg.content.splitlines():
                print(f"  | {line}")
        print("\n")


if __name__ == "__main__":
    main()
