import asyncio
import unittest
from contextlib import aclosing
from pathlib import Path

import sahayak
from fakes import FakeLLM, FakeRetriever, FakeSTT, FakeTTS, StallingLLM, tone
from sahayak.domain.events import (
    AudioReady,
    NoSpeech,
    SentenceReady,
    TranscriptReady,
    TurnFinished,
)
from sahayak.domain.language import Language
from sahayak.domain.models import AnswerSource, FAQHit
from sahayak.errors import InvalidRequestError, VoiceUnavailableError
from sahayak.services.conversation import ConversationService
from sahayak.services.prompting import PromptBuilder
from sahayak.services.retrieval import RetrievalPolicy, RetrievalService
from sahayak.services.safety import SafetyGuard
from sahayak.services.sessions import SessionStore
from sahayak.services.turns import TurnService

RULES = Path(sahayak.__file__).parent / "resources" / "safety_rules.yaml"


def make_session():
    return SessionStore(ttl_s=100, max_sessions=4, max_history_turns=3).get_or_create()


def make_conversation(llm, hits=()):
    return ConversationService(
        llm=llm,
        retrieval=RetrievalService(FakeRetriever(hits), RetrievalPolicy()),
        safety=SafetyGuard.from_yaml(RULES),
        prompts=PromptBuilder("Be kind."),
    )


async def collect(agen):
    async with aclosing(agen) as stream:
        return [item async for item in stream]


class ConversationTests(unittest.IsolatedAsyncioTestCase):
    async def test_model_answer_is_streamed_as_sentences_and_recorded(self):
        llm = FakeLLM(["A mammogram is ", "an X-ray. It ", "finds changes early."])
        session = make_session()
        sentences = await collect(
            make_conversation(llm).respond(session, "What is a mammogram?", Language.ENGLISH)
        )
        self.assertEqual(
            [s.text for s in sentences], ["A mammogram is an X-ray.", "It finds changes early."]
        )
        self.assertEqual([s.index for s in sentences], [0, 1])
        self.assertTrue(all(s.source is AnswerSource.MODEL for s in sentences))
        self.assertEqual(
            [m.content for m in session.messages()],
            ["What is a mammogram?", "A mammogram is an X-ray. It finds changes early."],
        )

    async def test_history_and_language_reach_the_prompt(self):
        llm = FakeLLM(["Ok."])
        conv = make_conversation(llm)
        session = make_session()
        await collect(conv.respond(session, "first question", Language.ENGLISH))
        await collect(conv.respond(session, "second question", Language.HINDI))
        second_prompt = llm.calls[1]
        self.assertIn("Reply in Hindi.", second_prompt[0].content)
        self.assertEqual([m.content for m in second_prompt[1:]], ["first question", "Ok.", "second question"])

    async def test_safety_guard_bypasses_retrieval_and_model(self):
        llm = FakeLLM(["should not be used"])
        retriever = FakeRetriever([FAQHit("q", "a", 0.99)])
        conv = ConversationService(
            llm=llm,
            retrieval=RetrievalService(retriever, RetrievalPolicy()),
            safety=SafetyGuard.from_yaml(RULES),
            prompts=PromptBuilder("x"),
        )
        sentences = await collect(conv.respond(make_session(), "Do I have breast cancer?", Language.GUJARATI))
        self.assertTrue(sentences)
        self.assertTrue(all(s.source is AnswerSource.SAFETY for s in sentences))
        self.assertIn("ડૉક્ટર", " ".join(s.text for s in sentences))
        self.assertEqual(llm.calls, [])
        self.assertEqual(retriever.queries, [])

    async def test_near_exact_faq_match_is_answered_verbatim(self):
        llm = FakeLLM(["unused"])
        hits = [FAQHit("What is a biopsy?", "A biopsy takes a small tissue sample. It is checked in a lab.", 0.97)]
        sentences = await collect(make_conversation(llm, hits).respond(make_session(), "biopsy?", Language.ENGLISH))
        self.assertEqual(
            [s.text for s in sentences],
            ["A biopsy takes a small tissue sample.", "It is checked in a lab."],
        )
        self.assertTrue(all(s.source is AnswerSource.FAQ for s in sentences))
        self.assertEqual(llm.calls, [])

    async def test_related_faqs_become_model_context(self):
        llm = FakeLLM(["Fine."])
        hits = [FAQHit("What is a biopsy?", "A tissue sample.", 0.7)]
        await collect(make_conversation(llm, hits).respond(make_session(), "tell me about biopsies", Language.ENGLISH))
        self.assertIn("A: A tissue sample.", llm.calls[0][0].content)

    async def test_empty_model_output_falls_back_to_a_safe_reply(self):
        with self.assertLogs("sahayak.services.conversation", level="WARNING"):
            sentences = await collect(
                make_conversation(FakeLLM([])).respond(make_session(), "hmm", Language.ENGLISH)
            )
        self.assertEqual(len(sentences), 1)
        self.assertIs(sentences[0].source, AnswerSource.SAFETY)
        self.assertIn("doctor", sentences[0].text)

    async def test_partial_answer_is_recorded_when_consumer_stops_early(self):
        session = make_session()
        conv = make_conversation(FakeLLM(["One. Two. Three."]))
        async with aclosing(conv.respond(session, "q", Language.ENGLISH)) as stream:
            async for _ in stream:
                break
        self.assertEqual(session.messages()[1].content, "One.")
        self.assertFalse(session.lock.locked())

    async def test_model_failure_propagates_and_releases_the_lock(self):
        session = make_session()
        conv = make_conversation(FakeLLM(["Start. "], fail_with=RuntimeError("boom")))
        with self.assertRaises(RuntimeError):
            await collect(conv.respond(session, "q", Language.ENGLISH))
        self.assertFalse(session.lock.locked())


def make_turns(llm, *, stt=None, tts=None, hits=()):
    return TurnService(
        conversation=make_conversation(llm, hits),
        stt=stt,
        tts=tts,
        default_language=Language.GUJARATI,
    )


class TurnTests(unittest.IsolatedAsyncioTestCase):
    async def test_voice_turn_event_order_and_content(self):
        stt, tts = FakeSTT("what is a mammogram?", Language.ENGLISH), FakeTTS()
        turns = make_turns(FakeLLM(["It is an X-ray. ", "It is quick."]), stt=stt, tts=tts)
        events = await collect(turns.run_voice_turn(make_session(), tone(), None))

        self.assertIsInstance(events[0], TranscriptReady)
        self.assertEqual(events[0].language, Language.ENGLISH)
        self.assertIsInstance(events[-1], TurnFinished)
        self.assertIs(events[-1].source, AnswerSource.MODEL)

        sentences = [e.sentence for e in events if isinstance(e, SentenceReady)]
        audio = [e for e in events if isinstance(e, AudioReady)]
        self.assertEqual([s.text for s in sentences], ["It is an X-ray.", "It is quick."])
        self.assertEqual([a.index for a in audio], [0, 1])
        # each sentence's text event precedes its audio event
        for i in (0, 1):
            text_pos = next(p for p, e in enumerate(events) if isinstance(e, SentenceReady) and e.sentence.index == i)
            audio_pos = next(p for p, e in enumerate(events) if isinstance(e, AudioReady) and e.index == i)
            self.assertLess(text_pos, audio_pos)
        self.assertEqual([t for t, _ in tts.spoken], ["It is an X-ray.", "It is quick."])

        metrics = events[-1].metrics
        self.assertIsNotNone(metrics.stt_ms)
        self.assertLessEqual(metrics.first_sentence_ms, metrics.first_audio_ms)
        self.assertLessEqual(metrics.first_audio_ms, metrics.total_ms)

    async def test_requested_language_overrides_detection(self):
        stt = FakeSTT("some text", Language.ENGLISH)
        turns = make_turns(FakeLLM(["Ok."]), stt=stt, tts=FakeTTS())
        events = await collect(turns.run_voice_turn(make_session(), tone(), Language.HINDI))
        self.assertEqual(events[0].language, Language.HINDI)
        self.assertEqual(stt.calls, [Language.HINDI])

    async def test_language_falls_back_to_script_detection(self):
        stt = FakeSTT("મેમોગ્રામ શું છે", None)
        turns = make_turns(FakeLLM(["Ok."]), stt=stt, tts=FakeTTS())
        events = await collect(turns.run_voice_turn(make_session(), tone(), None))
        self.assertEqual(events[0].language, Language.GUJARATI)

    async def test_empty_transcript_yields_no_speech_only(self):
        llm = FakeLLM(["unused"])
        turns = make_turns(llm, stt=FakeSTT("   "), tts=FakeTTS())
        events = await collect(turns.run_voice_turn(make_session(), tone(), None))
        self.assertEqual(len(events), 1)
        self.assertIsInstance(events[0], NoSpeech)
        self.assertEqual(llm.calls, [])

    async def test_text_turn_without_speech_has_no_audio(self):
        turns = make_turns(FakeLLM(["Hello there."]))
        events = await collect(turns.run_text_turn(make_session(), "hi", Language.ENGLISH))
        self.assertEqual([type(e) for e in events], [SentenceReady, TurnFinished])
        self.assertIsNone(events[-1].metrics.first_audio_ms)

    async def test_text_turn_validation_and_voice_availability(self):
        turns = make_turns(FakeLLM(["x"]))
        with self.assertRaises(InvalidRequestError):
            await collect(turns.run_text_turn(make_session(), "   ", None))
        with self.assertRaises(VoiceUnavailableError):
            await collect(turns.run_text_turn(make_session(), "hi", None, speak=True))
        with self.assertRaises(VoiceUnavailableError):
            await collect(turns.run_voice_turn(make_session(), tone(), None))
        self.assertFalse(turns.voice_available)

    async def test_unspeakable_sentences_are_not_synthesised(self):
        tts = FakeTTS()
        turns = make_turns(FakeLLM(["Hello there.\n", "—\n", "Bye now."]), stt=FakeSTT(), tts=tts)
        events = await collect(turns.run_voice_turn(make_session(), tone(), None))
        self.assertEqual([t for t, _ in tts.spoken], ["Hello there.", "Bye now."])
        self.assertEqual(sum(isinstance(e, SentenceReady) for e in events), 3)

    async def test_tts_failure_surfaces_and_cleans_up(self):
        turns = make_turns(FakeLLM(["Fine. ", "Explode here. ", "After."]), stt=FakeSTT(), tts=FakeTTS(fail_on="Explode"))
        before = len(asyncio.all_tasks())
        with self.assertRaises(RuntimeError):
            await collect(turns.run_voice_turn(make_session(), tone(), None))
        await asyncio.sleep(0)
        self.assertEqual(len(asyncio.all_tasks()), before)

    async def test_model_failure_surfaces(self):
        turns = make_turns(FakeLLM(["Start. "], fail_with=ValueError("model down")))
        with self.assertRaises(ValueError):
            await collect(turns.run_text_turn(make_session(), "hi", Language.ENGLISH))

    async def test_cancelling_a_turn_stops_the_model_and_releases_resources(self):
        llm = StallingLLM()
        turns = make_turns(llm, stt=FakeSTT(), tts=FakeTTS())
        session = make_session()
        before = len(asyncio.all_tasks())
        got_first = asyncio.Event()

        async def consume():
            async with aclosing(turns.run_voice_turn(session, tone(), None)) as stream:
                async for event in stream:
                    if isinstance(event, SentenceReady):
                        got_first.set()

        task = asyncio.create_task(consume())
        await asyncio.wait_for(got_first.wait(), timeout=2)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        await asyncio.sleep(0)

        self.assertTrue(llm.cancelled)
        self.assertFalse(session.lock.locked())
        self.assertEqual(len(asyncio.all_tasks()), before)
        self.assertEqual(session.messages()[1].content, "First sentence.")  # what was said is kept

    async def test_next_turn_can_start_after_cancellation(self):
        turns = make_turns(StallingLLM(), stt=FakeSTT(), tts=FakeTTS())
        session = make_session()

        async def first_sentence_then_stop():
            async with aclosing(turns.run_text_turn(session, "q", Language.ENGLISH)) as stream:
                async for event in stream:
                    if isinstance(event, SentenceReady):
                        return

        await asyncio.wait_for(first_sentence_then_stop(), timeout=2)
        events = await asyncio.wait_for(
            collect(make_turns(FakeLLM(["Again."])).run_text_turn(session, "q2", Language.ENGLISH)),
            timeout=2,
        )
        self.assertIsInstance(events[-1], TurnFinished)


if __name__ == "__main__":
    unittest.main()
