import json
import unittest

from fakes import tone
from sahayak.adapters.openai_sse import DONE, parse_stream_line
from sahayak.api.serialization import (
    decode_audio_frame,
    encode_audio_frame,
    error_payload,
    serialize_event,
    sse_frame,
)
from sahayak.domain.events import (
    AudioReady,
    NoSpeech,
    SentenceReady,
    TranscriptReady,
    TurnFinished,
    TurnMetrics,
)
from sahayak.domain.language import Language
from sahayak.domain.models import AnswerSentence, AnswerSource
from sahayak.errors import InvalidAudioError


class SerializationTests(unittest.TestCase):
    def test_events(self):
        self.assertEqual(
            serialize_event(TranscriptReady("નમસ્તે", Language.GUJARATI)),
            {"type": "transcript", "text": "નમસ્તે", "language": "gu"},
        )
        self.assertEqual(serialize_event(NoSpeech()), {"type": "no_speech"})
        self.assertEqual(
            serialize_event(SentenceReady(AnswerSentence(2, "Hi.", AnswerSource.FAQ))),
            {"type": "sentence", "index": 2, "text": "Hi.", "source": "faq"},
        )
        done = serialize_event(TurnFinished(AnswerSource.MODEL, TurnMetrics(10.0, 20.0, None, 30.0)))
        self.assertEqual(done["source"], "model")
        self.assertEqual(done["metrics"]["first_audio_ms"], None)

    def test_audio_is_not_json_serialisable(self):
        with self.assertRaises(TypeError):
            serialize_event(AudioReady(0, tone()))

    def test_audio_frame_roundtrip(self):
        frame = encode_audio_frame(300, tone(0.02))
        index, wav = decode_audio_frame(frame)
        self.assertEqual(index, 300)
        self.assertEqual(wav[:4], b"RIFF")

    def test_error_payload(self):
        self.assertEqual(
            error_payload(InvalidAudioError("bad")),
            {"type": "error", "code": "invalid_audio", "message": "bad"},
        )

    def test_sse_frame_keeps_unicode_and_names_the_event(self):
        frame = sse_frame({"type": "sentence", "text": "શું છે"})
        self.assertTrue(frame.startswith("event: sentence\ndata: "))
        self.assertTrue(frame.endswith("\n\n"))
        self.assertIn("શું છે", frame)
        self.assertEqual(json.loads(frame.split("data: ")[1])["text"], "શું છે")


class OpenAIStreamParsingTests(unittest.TestCase):
    def chunk(self, **delta):
        return "data: " + json.dumps({"choices": [{"delta": delta}]})

    def test_text_delta(self):
        self.assertEqual(parse_stream_line(self.chunk(content="Hello")), "Hello")

    def test_done_marker(self):
        self.assertIs(parse_stream_line("data: [DONE]"), DONE)

    def test_ignorable_lines(self):
        for line in ["", ": keep-alive", "event: ping", self.chunk(role="assistant"),
                     self.chunk(content=""), "data: not json", 'data: {"choices": []}', "data: 5"]:
            with self.subTest(line=line):
                self.assertIsNone(parse_stream_line(line))

    def test_unicode_delta(self):
        self.assertEqual(parse_stream_line(self.chunk(content="શું")), "શું")

    def test_golden_contract_fixtures(self):
        from pathlib import Path
        contract_path = Path(__file__).resolve().parents[2] / "contract" / "voice_frames.json"
        with open(contract_path, encoding="utf-8") as f:
            fixture = json.load(f)

        audio_fixture = fixture["audio_frame"]
        frame_bytes = bytes.fromhex(audio_fixture["frame_hex"])
        index, wav = decode_audio_frame(frame_bytes)
        self.assertEqual(index, audio_fixture["index"])
        self.assertEqual(wav.hex(), audio_fixture["wav_hex"])


if __name__ == "__main__":
    unittest.main()
