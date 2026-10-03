import unittest
from pathlib import Path

import sahayak
from sahayak.domain.language import Language
from sahayak.errors import ConfigurationError
from sahayak.services.safety import SafetyCategory, SafetyGuard

RULES = Path(sahayak.__file__).parent / "resources" / "safety_rules.yaml"


class PackagedRulesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guard = SafetyGuard.from_yaml(RULES)

    def category(self, text, lang=Language.ENGLISH):
        verdict = self.guard.check(text, lang)
        return verdict.category if verdict else None

    def test_informational_questions_pass_through(self):
        for text in [
            "What is a mammogram?",
            "Does breast cancer cause chest pain?",
            "How is a biopsy done?",
            "What are the stages of breast cancer?",
            "મેમોગ્રામ શું છે?",
            "ब्रेस्ट कैंसर के लक्षण क्या हैं?",
        ]:
            with self.subTest(text=text):
                self.assertIsNone(self.category(text))

    def test_personal_diagnosis_and_dosing(self):
        for text in [
            "Do I have breast cancer?",
            "How many mg should I take",
            "My biopsy report says something, what does it mean",
            "Should I stop my medication?",
        ]:
            with self.subTest(text=text):
                self.assertIs(self.category(text), SafetyCategory.PERSONAL_MEDICAL)

    def test_emergency_and_self_harm(self):
        self.assertIs(self.category("I can't breathe"), SafetyCategory.EMERGENCY)
        self.assertIs(self.category("I am bleeding heavily"), SafetyCategory.EMERGENCY)
        self.assertIs(self.category("I want to end my life"), SafetyCategory.SELF_HARM)

    def test_indic_patterns(self):
        self.assertIs(
            self.category("क्या मुझे कैंसर है", Language.HINDI), SafetyCategory.PERSONAL_MEDICAL
        )
        self.assertIs(
            self.category("શું મને બ્રેસ્ટ કેન્સર છે", Language.GUJARATI),
            SafetyCategory.PERSONAL_MEDICAL,
        )
        self.assertIs(self.category("आत्महत्या के विचार आ रहे हैं", Language.HINDI), SafetyCategory.SELF_HARM)

    def test_reply_matches_requested_language(self):
        hindi = self.guard.check("Do I have cancer", Language.HINDI)
        self.assertIn("डॉक्टर", hindi.reply)
        gujarati = self.guard.check("Do I have cancer", Language.GUJARATI)
        self.assertIn("ડૉક્ટર", gujarati.reply)

    def test_emergency_takes_priority_over_personal(self):
        verdict = self.guard.check("I can't breathe, do I have cancer?", Language.ENGLISH)
        self.assertIs(verdict.category, SafetyCategory.EMERGENCY)

    def test_every_category_has_a_reply_in_every_language(self):
        for rule in self.guard._rules:
            for language in Language:
                self.assertIn(language, rule.replies, f"{rule.category} missing {language}")


class ConfigValidationTests(unittest.TestCase):
    def test_rejects_unknown_category(self):
        with self.assertRaises(ConfigurationError):
            SafetyGuard.from_mapping({"categories": {"nonsense": {}}})

    def test_rejects_bad_regex(self):
        data = {"categories": {"emergency": {"patterns": {"en": ["("]}, "replies": {"en": "x"}}}}
        with self.assertRaises(ConfigurationError):
            SafetyGuard.from_mapping(data)

    def test_requires_english_reply(self):
        data = {"categories": {"emergency": {"patterns": {"en": ["x"]}, "replies": {"hi": "x"}}}}
        with self.assertRaises(ConfigurationError):
            SafetyGuard.from_mapping(data)

    def test_requires_patterns(self):
        data = {"categories": {"emergency": {"patterns": {}, "replies": {"en": "x"}}}}
        with self.assertRaises(ConfigurationError):
            SafetyGuard.from_mapping(data)


if __name__ == "__main__":
    unittest.main()
