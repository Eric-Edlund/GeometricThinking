from flask import Blueprint, Flask, jsonify, request
from sqlalchemy import Engine, create_engine, select, MetaData
import sqlalchemy
from sqlalchemy.orm import Session
from schema import Base, Node
from flask import Flask
from flask_cors import CORS, cross_origin
from asyncio import Event
from dataclasses import dataclass, field


def node_to_dict(node: Node):
    return {
        'id': node.id,
        'x': node.x,
        'y': node.y,
        'width': node.width,
        'height': node.height,
        'text': node.text,
    }


class GraphProxy:
    '''Handles state sharing and synchronization with the database.'''
    _id: int
    _engine: Engine
    _stateNum: int = 0
    _state: dict[int, dict]
    _changeEvent = Event()

    def __init__(self, engine: Engine, id: int):
        self._engine = engine
        self._id = id
        assert id == 1
        with Session(self._engine) as sess:
            nodes = sess.scalars(select(Node))
            self._state = {(n.id): node_to_dict(n) for n in nodes}
            sess.expunge_all()

    def currentStateNum(self) -> int:
        return self._stateNum

    def get(self) -> list[dict]:
        return list(self._state.values())

    def update(self, nodes: list[Node]) -> int:
        self._stateNum += 1
        for node in nodes:
            self._state[node.id] = node_to_dict(node)

        print(self._state)

        self._changeEvent.set()
        self._changeEvent.clear()

        return self._stateNum

    async def watch(self):
        await self._changeEvent.wait()




def RealtimeGraphServer(engine: Engine) -> Blueprint:
    bp = Blueprint('RealtimeGraphServer', __name__)

    graph1 = GraphProxy(engine, 1)

    @bp.get('/<graph_id>/get')
    def get_graph(graph_id: str):
        assert graph_id == '1', f"{graph_id}"

        return jsonify({
                'graphId': 1,
                'nodes': [{
                    'id': n['id'],
                    'pos': [n['x'], n['y']],
                    'dims': [n['width'], n['height']],
                    'text': n['text'],
                } for n in graph1.get()],
            })


    @bp.post('/<graph_id>/update')
    def update_graph(graph_id: str):
        assert graph_id == '1'

        req = request.get_json()

        match req:
            case {
            "graphId": 1,
            "changed": nodes,
            }:
                graph1.update([Node(
                    id=n['id'],
                    x=n['pos'][0],
                    y=n['pos'][1],
                    width=n['dims'][0],
                    height=n['dims'][1],
                    text=n['text'],
                ) for n in nodes])

            case _:
                raise ValueError()

        return jsonify({'status': 'ok'})

    # @bp.get('/<graph_id>/watch')
    # async def watch_graph(graph_id: str):
    #     assert graph_id == '1'
    #     await graph1_updated.wait()
    #
    #     return jsonify({
    #         "graphId": 1,
    #         "changed": {
    #             "nodes": 
    #         }
    #     })


    return bp

