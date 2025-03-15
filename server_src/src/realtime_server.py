from contextlib import contextmanager
from typing import ContextManager
from quart import Blueprint, jsonify, request
from sqlalchemy.orm import Session
from src.schema import Base, Node
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
    prev_session_id = 0

    server_shutdown = False
    async def autosave():
        while not server_shutdown:
            await asyncio.sleep(1)
            graph1.save()
    asyncio.get_event_loop().create_task(autosave())

    @bp.get('/newSession')
    async def create_session():
        nonlocal prev_session_id
        prev_session_id += 1

        return jsonify({
            'session': f'session_{prev_session_id}',
        })


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
        assert graph_id == '1'

        session = request.headers['Realtime-Graph-Session']
        assert session != ''

        assert (req := await request.get_json()), f"{request.get_data()}"
        assert req['graphId'] == int(graph_id), f"{req['graphId']} != {graph_id}, {type(req['graphId'])} {type(graph_id)}"
        assert (nodes := req['changed']['nodes'])

        update = []
        for n in nodes:
            assert isinstance(local_id := n['id'], int)
            if local_id < 0:
                foreign_names.setdefault(session, {})
                if local_id not in foreign_names[session]:
                    n['id'] = None
                    foreign_names[session][local_id] = graph1.makeIdFor(node_from_dict(n))
                n['id'] = foreign_names[session][local_id]

            update.append(node_from_dict(n))
        graph1.update(update)

        return jsonify({'changeId': graph1.currentStateNum()})

    @bp.get('/<graph_id>/watch/<change_id>')
    async def watch_graph(graph_id: str, change_id: str):
        assert graph_id == '1'
        state_id: int = int(change_id)

        session = request.headers['Realtime-Graph-Session']
        assert session != ''

        await graph1.watch(state_id)

        return jsonify({
            "graphId": 1,
            "changeId": graph1.currentStateNum(),
            "changed": {
                'nodes': [node_to_dict(n) for n in graph1.get()],
            },
            "id_map": foreign_names.get(session, None),
        })

    yield bp

    server_shutdown = True
    graph1.save()

