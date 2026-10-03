import unittest

from sahayak.domain.language import Language
from sahayak.services.language import detect_language
from sahayak.services.textprep import has_speakable_content, prepare_for_speech


class LanguageTests(unittest.TestCase):
    def test_parse_codes(self):
        self.assertIs(Language.parse("gu"), Language.GUJARATI)
        self.assertIs(Language.parse("HI-IN"), Language.HINDI)
        self.assertIs(Language.parse("en_US"), Language.ENGLISH)
        self.assertIsNone(Language.parse("mr"))
        self.assertIsNone(Language.parse(""))
        self.assertIsNone(Language.parse(None))

    def test_detects_scripts(self):
        d = Language.ENGLISH
        self.assertIs(detect_language("મેમોગ્રામ શું છે?", d), Language.GUJARATI)
        self.assertIs(detect_language("मैमोग्राम क्या है?", d), Language.HINDI)
        self.assertIs(detect_language("What is a mammogram?", Language.HINDI), Language.ENGLISH)

    def test_mixed_text_uses_dominant_script(self):
        self.assertIs(
            detect_language("મને breast cancer વિશે જણાવો કે શું થાય છે", Language.ENGLISH),
            Language.GUJARATI,
        )

    def test_no_letters_falls_back_to_default(self):
        self.assertIs(detect_language("123 ?!", Language.HINDI), Language.HINDI)


class TextPrepTests(unittest.TestCase):
    def test_strips_markdown(self):
        raw = "## Title\n- **Bold** item with `code`\n1. Second [link](http://x.y) here"
        self.assertEqual(prepare_for_speech(raw), "Title Bold item with code Second link here")

    def test_removes_urls_and_emoji(self):
        self.assertEqual(prepare_for_speech("See https://a.b/c now 😊"), "See now")

    def test_keeps_indic_text_and_zwj_intact(self):
        text = "क्‍या यह ठीक है"  # contains U+200D
        self.assertEqual(prepare_for_speech(text), text)

    def test_speakable_check(self):
        self.assertTrue(has_speakable_content("ઠીક"))
        self.assertTrue(has_speakable_content("Step 2"))
        self.assertFalse(has_speakable_content("—  ..."))


if __name__ == "__main__":
    unittest.main()
