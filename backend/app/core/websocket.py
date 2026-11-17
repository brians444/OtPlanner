import asyncio

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, topics: list[str]):
        await ws.accept()
        for t in topics:
            self.connections.setdefault(t, set()).add(ws)

    def disconnect(self, ws: WebSocket):
        for t in list(self.connections):
            self.connections[t].discard(ws)
            if not self.connections[t]:
                del self.connections[t]

    async def broadcast(self, topic: str, message: dict):
        for ws in list(self.connections.get(topic, ())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def notify(topic: str = "data", msg_type: str = "data_updated") -> None:
    """Publica una señal desde endpoints sync (threadpool) al loop principal."""
    if _loop is None or not manager.connections:
        return
    asyncio.run_coroutine_threadsafe(
        manager.broadcast(topic, {"type": msg_type}), _loop)