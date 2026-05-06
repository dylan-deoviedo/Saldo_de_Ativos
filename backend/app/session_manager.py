from __future__ import annotations

import uuid

from app.deriv.session import DerivSession


class SessionManager:
    """Sessões em memória (em produção, use Redis + worker dedicado)."""

    def __init__(self) -> None:
        self._sessions: dict[str, DerivSession] = {}

    async def create(self, token: str) -> tuple[str, DerivSession]:
        session_id = str(uuid.uuid4())
        session = DerivSession()
        await session.connect(token)
        self._sessions[session_id] = session
        return session_id, session

    def get(self, session_id: str) -> DerivSession | None:
        return self._sessions.get(session_id)

    async def destroy(self, session_id: str) -> bool:
        session = self._sessions.pop(session_id, None)
        if session:
            await session.close()
            return True
        return False

    async def shutdown_all(self) -> None:
        for sid in list(self._sessions.keys()):
            await self.destroy(sid)
