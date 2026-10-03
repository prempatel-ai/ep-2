import json
import tempfile
import threading
import unittest
import wave
from io import BytesIO
from pathlib import Path

import numpy as np

from sahayak.core.blocking import BlockingRunner
from sahayak.domain.audio import AudioClip, clip_from_pcm16
from sahayak.domain.language import Language
from sahayak.errors import ConfigurationError, InvalidAudioError
from sahayak.services.faq_loader import load_faq_entries


def write(lines):
    f = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False, encoding="utf-8")
    f.write("\n".join(lines))
    f.close()
    return Path(f.name)


def rec(q, a, **extra):
    return json.dumps({"question": q, "answer": a, **extra}, ensure_ascii=False)


class FAQLoaderTests(unittest.TestCase):
    def test_loads_and_reports(self):
        path = write(
            [
                rec("What is a mammogram?", "An X-ray of the breast.", lang="en"),
                rec("  what is a  mammogram?  ", "An X-ray of the breast."),  # duplicate
                rec("What is a mammogram?", "Something different."),  # conflict
                rec("મેમોગ્રામ શું છે?", "સ્તનનો એક્સ-રે.", lang="gu"),
                "not json",
                rec("", "no question"),
                rec("Q", "A", lang="xx"),
                "",
            ]
        )
        entries, report = load_faq_entries(path)
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0].language, Language.ENGLISH)
        self.assertEqual(entries[1].language, Language.GUJARATI)
        self.assertEqual(report.loaded, 2)
        self.assertEqual(report.duplicates, 1)
        self.assertEqual(report.conflicts, [3])
        self.assertEqual([n for n, _ in report.invalid], [5, 6, 7])
        self.assertEqual(report.lines_read, 7)

    def test_ids_are_stable_across_loads(self):
        path = write([rec("What is a biopsy?", "A sample.")])
        first, _ = load_faq_entries(path)
        second, _ = load_faq_entries(path)
        self.assertEqual(first[0].id, second[0].id)

    def test_missing_file_and_empty_file_raise(self):
        with self.assertRaises(ConfigurationError):
            load_faq_entries(Path("/nonexistent/faqs.jsonl"))
        with self.assertRaises(ConfigurationError):
            load_faq_entries(write(["garbage"]))


class AudioTests(unittest.TestCase):
    def test_pcm16_roundtrip_through_wav(self):
        samples = np.array([0, 16384, -16384, 32767], dtype="<i2")
        clip = clip_from_pcm16(samples.tobytes(), 16000)
        self.assertEqual(clip.samples.dtype, np.float32)
        self.assertAlmostEqual(float(clip.samples[1]), 0.5, places=3)

        with wave.open(BytesIO(clip.to_wav_bytes())) as wav:
            self.assertEqual(wav.getnchannels(), 1)
            self.assertEqual(wav.getsampwidth(), 2)
            self.assertEqual(wav.getframerate(), 16000)
            decoded = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2")
        self.assertTrue(np.all(np.abs(decoded.astype(int) - samples.astype(int)) <= 2))

    def test_wav_clips_out_of_range_samples(self):
        clip = AudioClip(np.array([2.0, -2.0], dtype=np.float32), 8000)
        with wave.open(BytesIO(clip.to_wav_bytes())) as wav:
            decoded = np.frombuffer(wav.readframes(2), dtype="<i2")
        self.assertEqual(decoded.tolist(), [32767, -32767])

    def test_invalid_pcm_is_rejected(self):
        with self.assertRaises(InvalidAudioError):
            clip_from_pcm16(b"", 16000)
        with self.assertRaises(InvalidAudioError):
            clip_from_pcm16(b"\x00\x01\x02", 16000)

    def test_clip_must_be_mono(self):
        with self.assertRaises(ValueError):
            AudioClip(np.zeros((2, 4), dtype=np.float32), 16000)

    def test_duration(self):
        self.assertAlmostEqual(AudioClip(np.zeros(8000, dtype=np.float32), 16000).duration_s, 0.5)


class BlockingRunnerTests(unittest.IsolatedAsyncioTestCase):
    async def test_runs_off_the_event_loop_on_one_thread(self):
        runner = BlockingRunner("test")
        main = threading.get_ident()
        ids = {await runner.run(threading.get_ident) for _ in range(5)}
        runner.close()
        self.assertEqual(len(ids), 1)
        self.assertNotIn(main, ids)

    async def test_passes_arguments(self):
        runner = BlockingRunner("test")
        self.assertEqual(await runner.run(pow, 2, 10), 1024)
        runner.close()


if __name__ == "__main__":
    unittest.main()
