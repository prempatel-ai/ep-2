"""Answer one user message as a stream of sentences.

Order of precedence:
  1. the safety guard (fixed, reviewed replies),
  2. a near-exact match in the verified FAQ (answered verbatim, no model involved),
  3. the language model, given related FAQ entries as reference when there are any.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import aclosing

from sahayak.domain.language import Language
from sahayak.domain.models import AnswerSentence, AnswerSource
from sahayak.domain.ports import LanguageModel
from sahayak.services.messages import NO_ANSWER
from sahayak.services.prompting import PromptBuilder
from sahayak.services.retrieval import RetrievalMode, RetrievalService
from sahayak.services.safety import SafetyGuard
from sahayak.services.segmenter import SentenceSegmenter
from sahayak.services.sessions import Session

logger = logging.getLogger(__name__)


class ConversationService:
    def __init__(
        self,
        *,
        llm: LanguageModel,
        retrieval: RetrievalService,
        safety: SafetyGuard,
        prompts: PromptBuilder,
        max_sentence_chars: int = 200,
    ) -> None:
        self._llm = llm
        self._retrieval = retrieval
        self._safety = safety
        self._prompts = prompts
        self._max_sentence_chars = max_sentence_chars

    async def respond(
        self, session: Session, text: str, language: Language
    ) -> AsyncIterator[AnswerSentence]:
        """Yield the answer sentence by sentence.

        Holds the session lock for the duration, and records whatever was actually
        produced in the session history, including when the turn is cancelled part-way
        (for example because the user interrupted).
        """
        async with session.lock:
            produced: list[str] = []
            try:
                async with aclosing(self._generate(session, text, language)) as stream:
                    async for sentence in stream:
                        produced.append(sentence.text)
                        yield sentence
            finally:
                if produced:
                    session.record_exchange(text, " ".join(produced))

    async def _generate(
        self, session: Session, text: str, language: Language
    ) -> AsyncIterator[AnswerSentence]:
        verdict = self._safety.check(text, language)
        if verdict is not None:
            logger.info("safety guard answered (category=%s)", verdict.category)
            for sentence in self._split(verdict.reply, AnswerSource.SAFETY):
                yield sentence
            return

        result = await self._retrieval.lookup(text)

        if result.mode is RetrievalMode.DIRECT:
            for sentence in self._split(result.hits[0].answer, AnswerSource.FAQ):
                yield sentence
            return

        messages = self._prompts.build(
            user_text=text,
            language=language,
            history=session.messages(),
            context=result.hits if result.mode is RetrievalMode.CONTEXT else (),
        )

        segmenter = SentenceSegmenter(self._max_sentence_chars, first_chunk_early=True)
        index = 0
        async with aclosing(self._llm.stream(messages)) as fragments:
            async for fragment in fragments:
                for piece in segmenter.feed(fragment):
                    yield AnswerSentence(index, piece, AnswerSource.MODEL)
                    index += 1
        for piece in segmenter.flush():
            yield AnswerSentence(index, piece, AnswerSource.MODEL)
            index += 1

        if index == 0:
            logger.warning("language model returned an empty reply")
            fallback = NO_ANSWER.get(language, NO_ANSWER[Language.ENGLISH])
            yield AnswerSentence(0, fallback, AnswerSource.SAFETY)

    def _split(self, text: str, source: AnswerSource) -> list[AnswerSentence]:
        segmenter = SentenceSegmenter(self._max_sentence_chars)
        pieces = [*segmenter.feed(text), *segmenter.flush()]
        return [AnswerSentence(i, piece, source) for i, piece in enumerate(pieces)]
