"""In-memory conversation sessions.

Conversations are medical in nature, so nothing is written to disk: sessions live
in memory only, expire after a period of inactivity, and can be dropped on request.
"""

from __future__ import annotations

import asyncio
import secrets
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass, field

from sahayak.domain.models import ChatMessage


@dataclass(slots=True)
class Session:
    id: str
    last_active: float
    max_messages: int
    history: list[ChatMessage] = field(default_factory=list)
    # Serialises turns within a session so history is never interleaved.
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def messages(self) -> tuple[ChatMessage, ...]:
        return tuple(self.history)

    def record_exchange(self, user_text: str, reply_text: str) -> None:
        self.history.append(ChatMessage("user", user_text))
        self.history.append(ChatMessage("assistant", reply_text))
        overflow = len(self.history) - self.max_messages
        if overflow > 0:
            del self.history[:overflow]


class SessionStore:
    def __init__(
        self,
        *,
        ttl_s: float,
        max_sessions: int,
        max_history_turns: int,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if max_sessions < 1 or max_history_turns < 1:
            raise ValueError("max_sessions and max_history_turns must be at least 1")
        self._ttl_s = ttl_s
        self._max_sessions = max_sessions
        self._max_messages = max_history_turns * 2
        self._clock = clock
        self._sessions: OrderedDict[str, Session] = OrderedDict()

    def get_or_create(self, session_id: str | None = None) -> Session:
        now = self._clock()
        self._evict_expired(now)
        if session_id is not None and session_id in self._sessions:
            session = self._sessions[session_id]
            session.last_active = now
            self._sessions.move_to_end(session_id)
            return session

        session = Session(
            id=session_id or secrets.token_urlsafe(16),
            last_active=now,
            max_messages=self._max_messages,
        )
        self._sessions[session.id] = session
        while len(self._sessions) > self._max_sessions:
            self._sessions.popitem(last=False)
        return session

    def drop(self, session_id: str) -> bool:
        return self._sessions.pop(session_id, None) is not None

    def __len__(self) -> int:
        return len(self._sessions)

    def _evict_expired(self, now: float) -> None:
        # Entries are ordered by last use, so expired ones are always at the front.
        while self._sessions:
            oldest_id, oldest = next(iter(self._sessions.items()))
            if now - oldest.last_active <= self._ttl_s:
                break
            del self._sessions[oldest_id]
