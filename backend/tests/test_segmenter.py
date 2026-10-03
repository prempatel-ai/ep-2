import random
import unittest

from sahayak.services.segmenter import SentenceSegmenter


def run(chunks, max_chars=200):
    seg = SentenceSegmenter(max_chars)
    out = []
    for chunk in chunks:
        out.extend(seg.feed(chunk))
    out.extend(seg.flush())
    return out


class SegmenterTests(unittest.TestCase):
    def test_splits_on_terminators_followed_by_space(self):
        self.assertEqual(
            run(["Hello there. How are you? Fine!"]),
            ["Hello there.", "How are you?", "Fine!"],
        )

    def test_does_not_split_decimals_or_abbreviations(self):
        self.assertEqual(
            run(["The dose is 2.5 mg. Ask Dr. Shah today."]),
            ["The dose is 2.5 mg.", "Ask Dr. Shah today."],
        )

    def test_handles_danda_for_hindi_and_gujarati(self):
        self.assertEqual(
            run(["यह पहला वाक्य है। यह दूसरा है।"]),
            ["यह पहला वाक्य है।", "यह दूसरा है।"],
        )
        self.assertEqual(run(["આ પહેલું છે. આ બીજું છે."]), ["આ પહેલું છે.", "આ બીજું છે."])

    def test_waits_for_following_character_before_ending_a_sentence(self):
        seg = SentenceSegmenter()
        self.assertEqual(seg.feed("Value is 3."), [])  # could still become 3.5
        self.assertEqual(seg.feed("5 units. Next"), ["Value is 3.5 units."])
        self.assertEqual(seg.flush(), ["Next"])

    def test_newline_ends_a_sentence(self):
        self.assertEqual(run(["First line\nSecond line"]), ["First line", "Second line"])

    def test_closing_quote_stays_with_sentence(self):
        self.assertEqual(run(['He said "stop." Then left.']), ['He said "stop."', "Then left."])

    def test_chunking_does_not_change_the_result(self):
        text = (
            "A mammogram is an X-ray of the breast. It can find changes early! "
            "Is it painful? Some people feel pressure, but it is brief. See Dr. Shah for 2.5 "
            "follow-ups."
        )
        expected = run([text])
        rng = random.Random(7)
        for _ in range(200):
            cuts = sorted(rng.sample(range(1, len(text)), k=rng.randint(1, 12)))
            chunks = [text[a:b] for a, b in zip([0, *cuts], [*cuts, len(text)], strict=True)]
            self.assertEqual(run(chunks), expected)
        self.assertEqual(run(list(text)), expected)  # one character at a time

    def test_overlong_sentence_is_broken_at_a_clause(self):
        text = "word " * 12 + "first part, " + "word " * 12 + "second part"
        pieces = run([text], max_chars=80)
        self.assertGreater(len(pieces), 1)
        self.assertTrue(all(len(p) <= 80 for p in pieces))
        self.assertEqual(" ".join(pieces).split(), text.split())

    def test_overlong_text_without_spaces_is_hard_cut(self):
        pieces = run(["x" * 100], max_chars=40)
        self.assertEqual([len(p) for p in pieces], [40, 40, 20])

    def test_empty_input(self):
        self.assertEqual(run([]), [])
        self.assertEqual(run(["   \n  "]), [])

    def test_rejects_tiny_limit(self):
        with self.assertRaises(ValueError):
            SentenceSegmenter(5)


if __name__ == "__main__":
    unittest.main()
