from contextlib import contextmanager
from typing import ContextManager
from quart import Blueprint, jsonify, request
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session
from src.schema import Base, Node
from asyncio import Event
from src.graph_proxy import GraphProxy
import asyncio


def node_to_dict(node: Node):
    return {
        'id': node.id,
        'pos': [node.x, node.y],
        'dims': [node.width, node.height],
        'text': node.text,
        'type': node.node_type or 'source',
    }


def node_from_dict(d: dict):
    return Node(
        id=d['id'],
        x=d['pos'][0],
        y=d['pos'][1],
        width=d['dims'][0],
        height=d['dims'][1],
        text=d['text'],
        node_type=d.get('type', None)
    )


@contextmanager
def RealtimeGraphServer(sess: Session):
    bp = Blueprint('RealtimeGraphServer', __name__)

    graph1 = GraphProxy(sess, 1)
    # client sessions -> client node id -> actual node id
    foreign_names: dict[str, dict[int, int]] = {}

    server_shutdown = False
    async def autosave():
        while not server_shutdown:
            await asyncio.sleep(1)
            graph1.save()
    asyncio.get_event_loop().create_task(autosave())

    @bp.get('/<graph_id>/get')
    async def get_graph(graph_id: str):
        assert graph_id == '1', f"{graph_id}"

        return jsonify({
                'graphId': 1,
                'changeId': graph1.currentStateNum(),
                'nodes': [node_to_dict(n) for n in graph1.get()],
            })

    @bp.post('/<graph_id>/update')
    async def update_graph(graph_id: str):
        print("Recieved /graphid/update")
        assert graph_id == '1'

        req = await request.get_json()

        match req:
            case {
            "graphId": 1,
            "changed": {
                "nodes": nodes,
            }, }:
                update = []
                for n in nodes:
                    print("Update mentioned", n['id'])
                    assert isinstance(local_id := n['id'], int)
                    if local_id < 0:
                        foreign_names.setdefault('session1', {})
                        if local_id not in foreign_names['session1']:
                            n['id'] = None
                            foreign_names['session1'][local_id] = graph1.makeIdFor(node_from_dict(n))
                            print("Made id for node", local_id, foreign_names['session1'][local_id])
                        n['id'] = foreign_names['session1'][local_id]

                    update.append(node_from_dict(n))
                print("Saving udpate")
                graph1.update(update)

            case _:
                raise ValueError()

        return jsonify({'changeId': graph1.currentStateNum()})

    @bp.get('/<graph_id>/watch/<change_id>')
    async def watch_graph(graph_id: str, change_id: str):
        assert graph_id == '1'
        state_id: int = int(change_id)

        await graph1.watch(state_id)
        print('Watched', state_id, '->', graph1.currentStateNum())

        return jsonify({
            "graphId": 1,
            "changeId": graph1.currentStateNum(),
            "changed": {
                'nodes': [node_to_dict(n) for n in graph1.get()],
            },
            "id_map": foreign_names.get('session1', None),
        })

    yield bp

    server_shutdown = True
    graph1.save()

