from sqlalchemy import select
from sqlalchemy.orm import Session
from asyncio import Event

from src.schema import Node

class GraphProxy:
    '''Handles state sharing and synchronization with the database.'''
    _id: int
    _session: Session
    _stateNum: int = 0
    _nodes: dict[int, Node]
    _changeEvent = Event()

    def __init__(self, sess: Session, id: int):
        self._session = sess
        self._id = id
        assert id == 1
        nodes = self._session.scalars(select(Node))
        self._nodes = {(n.id): n for n in nodes}
        sess.expunge_all()

    def save(self):
        for node in self._nodes.values():
            self._session.merge(node)
        self._session.commit()

    def makeIdFor(self, node: Node) -> int:
        self._session.add(node)
        self._session.commit()
        return node.id

    def currentStateNum(self) -> int:
        return self._stateNum

    def get(self) -> list[Node]:
        return list(self._nodes.values())

    def update(self, nodes: list[Node]) -> int:
        self._stateNum += 1
        for node in nodes:
            assert node.id, node.id > 0
            self._nodes[node.id] = node
            self._session.merge(node)

        self._changeEvent.set()
        self._changeEvent.clear()

        return self._stateNum

    async def watch(self, stateNum: int):
        if stateNum < self._stateNum:
            return
        assert stateNum <= self._stateNum
        await self._changeEvent.wait()


