import asyncio
import unittest

from fakes import FakeRetriever
from sahayak.domain.language import Language
from sahayak.domain.models import ChatMessage, FAQHit
from sahayak.errors import ConfigurationError
from sahayak.services.prompting import PromptBuilder
from sahayak.services.retrieval import RetrievalMode, RetrievalPolicy, RetrievalService
from sahayak.services.sessions import SessionStore


def hit(score, q="q", a="a"):
    return FAQHit(q, a, score)


class RetrievalTests(unittest.IsolatedAsyncioTestCase):
    def service(self, hits, **kw):
        return RetrievalService(FakeRetriever(hits, **kw), RetrievalPolicy())

    async def test_direct_when_score_is_very_high(self):
        result = await self.service([hit(0.7), hit(0.95, "best")]).lookup("x")
        self.assertIs(result.mode, RetrievalMode.DIRECT)
        self.assertEqual([h.question for h in result.hits], ["best"])

    async def test_context_keeps_only_relevant_hits_in_score_order(self):
        result = await self.service([hit(0.6, "b"), hit(0.8, "a"), hit(0.2, "c")]).lookup("x")
        self.assertIs(result.mode, RetrievalMode.CONTEXT)
        self.assertEqual([h.question for h in result.hits], ["a", "b"])

    async def test_none_when_nothing_is_relevant_or_empty(self):
        self.assertIs((await self.service([hit(0.3)]).lookup("x")).mode, RetrievalMode.NONE)
        self.assertIs((await self.service([]).lookup("x")).mode, RetrievalMode.NONE)

    async def test_retrieval_failure_degrades_to_none(self):
        with self.assertLogs("sahayak.services.retrieval", level="ERROR"):
            result = await self.service([hit(0.99)], fail=True).lookup("x")
        self.assertIs(result.mode, RetrievalMode.NONE)

    def test_policy_validation(self):
        with self.assertRaises(ValueError):
            RetrievalPolicy(context_threshold=0.9, direct_threshold=0.5)
        with self.assertRaises(ValueError):
            RetrievalPolicy(top_k=0)
        with self.assertRaises(ValueError):
            RetrievalPolicy(direct_threshold=1.5)


class SessionTests(unittest.IsolatedAsyncioTestCase):
    def store(self, **kw):
        self.now = 0.0
        defaults = dict(ttl_s=100, max_sessions=3, max_history_turns=2)
        return SessionStore(**{**defaults, **kw}, clock=lambda: self.now)

    async def test_reuses_existing_session_and_creates_ids(self):
        store = self.store()
        a = store.get_or_create()
        self.assertGreaterEqual(len(a.id), 16)
        self.assertIs(store.get_or_create(a.id), a)
        self.assertEqual(store.get_or_create("client-chosen-id").id, "client-chosen-id")

    async def test_history_is_bounded(self):
        store = self.store(max_history_turns=2)
        s = store.get_or_create()
        for i in range(5):
            s.record_exchange(f"q{i}", f"a{i}")
        self.assertEqual([m.content for m in s.messages()], ["q3", "a3", "q4", "a4"])

    async def test_expiry(self):
        store = self.store(ttl_s=100)
        a = store.get_or_create("aaaaaaaa")
        self.now = 99
        self.assertIs(store.get_or_create("aaaaaaaa"), a)  # touching refreshes it
        self.now = 190
        self.assertIs(store.get_or_create("aaaaaaaa"), a)
        self.now = 400
        self.assertIsNot(store.get_or_create("aaaaaaaa"), a)

    async def test_capacity_evicts_least_recently_used(self):
        store = self.store(max_sessions=2)
        store.get_or_create("s1xxxxxx")
        store.get_or_create("s2xxxxxx")
        store.get_or_create("s1xxxxxx")  # s2 is now the oldest
        store.get_or_create("s3xxxxxx")
        self.assertEqual(len(store), 2)
        self.assertFalse(store.drop("s2xxxxxx"))
        self.assertTrue(store.drop("s1xxxxxx"))

    async def test_lock_serialises_turns(self):
        s = self.store().get_or_create()
        order = []

        async def turn(name):
            async with s.lock:
                order.append(f"{name}-start")
                await asyncio.sleep(0.01)
                order.append(f"{name}-end")

        await asyncio.gather(turn("a"), turn("b"))
        self.assertEqual(order, ["a-start", "a-end", "b-start", "b-end"])


class PromptTests(unittest.TestCase):
    def test_layout_with_history_and_context(self):
        builder = PromptBuilder("Be kind.")
        history = [ChatMessage("user", "hi"), ChatMessage("assistant", "hello")]
        messages = builder.build(
            user_text="What is a biopsy?",
            language=Language.GUJARATI,
            history=history,
            context=[FAQHit("What is a biopsy?", "A small tissue sample.", 0.8)],
        )
        self.assertEqual([m.role for m in messages], ["system", "user", "assistant", "user"])
        system = messages[0].content
        self.assertTrue(system.startswith("Be kind."))
        self.assertIn("Reply in Gujarati.", system)
        self.assertIn("[1] Q: What is a biopsy?", system)
        self.assertIn("A: A small tissue sample.", system)
        self.assertEqual(messages[-1], ChatMessage("user", "What is a biopsy?"))

    def test_no_context_block_without_context(self):
        system = PromptBuilder("Be kind.").build(user_text="x", language=Language.ENGLISH)[0]
        self.assertNotIn("reference", system.content)

    def test_empty_prompt_is_rejected(self):
        with self.assertRaises(ConfigurationError):
            PromptBuilder("   ")


if __name__ == "__main__":
    unittest.main()
