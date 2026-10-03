"""Fixed user-facing messages that are not model output."""

from __future__ import annotations

from collections.abc import Mapping

from sahayak.domain.language import Language

NO_ANSWER: Mapping[Language, str] = {
    Language.ENGLISH: "Sorry, I couldn't find an answer to that. Please ask your doctor.",
    Language.HINDI: "माफ़ कीजिए, मुझे इसका जवाब नहीं मिला। कृपया अपने डॉक्टर से पूछें।",
    Language.GUJARATI: "માફ કરશો, મને આનો જવાબ મળ્યો નથી. કૃપા કરીને તમારા ડૉક્ટરને પૂછો.",
}
