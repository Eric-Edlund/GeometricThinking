import unittest
from quart import Quart
from sqlalchemy import Engine, create_engine, MetaData, select, func
from sqlalchemy.orm import Session
from src.schema import Base, Node
from quart_cors import cors
from src.realtime_server import RealtimeGraphServer
import asyncio
from tests.util import actually_not_async
from tests.utils.synthetic_data import insert_synthetic



class Test(unittest.TestCase):
    @actually_not_async
    async def test_session(self):
        e = create_engine('sqlite:///data.db')
        Base.metadata.create_all(bind=e)
        insert_synthetic(e)
        app = Quart(__name__)
        sess = Session(e)
        service_context = RealtimeGraphServer(sess)
        service = service_context.__enter__()
        app.register_blueprint(service, url_prefix="/apiv1")
        _ = cors(app)
        app.config['CORS_HEADERS'] = 'Content-Type'

        client = app.test_client()

        res = await client.get('/apiv1/newSession')
        obj = await res.get_json()
        assert (first := obj['session'])

        res = await client.get('/apiv1/newSession')
        obj = await res.get_json()
        assert (second := obj['session'])
        assert first != second, f"{first} != {second}"
        assert type(first) == str



    @actually_not_async
    async def test_sync(self):
        e = create_engine('sqlite:///data.db')
        Base.metadata.create_all(bind=e)
        insert_synthetic(e)
        app = Quart(__name__)
        sess = Session(e)
        service_context = RealtimeGraphServer(sess)
        service = service_context.__enter__()
        app.register_blueprint(service, url_prefix="/apiv1")
        _ = cors(app)
        app.config['CORS_HEADERS'] = 'Content-Type'

        client = app.test_client()

        session = (await (await client.get('/apiv1/newSession')).get_json())['session']

        # Get works
        res = await client.get('/apiv1/1/get')
        assert res.status_code == 200
        json = await res.get_json()

        initial_change_id = json['changeId']
        print('changeid:', initial_change_id)

        # Watch of old state id returns immediately
        res = await client.get(f'/apiv1/1/watch/{initial_change_id - 1}', headers={
            'Realtime-Graph-Session': session,
        })
        assert res.status_code == 200
        json = await res.get_json()
        assert json['changeId'] == initial_change_id

        # Watch of current state id blocks until there is an update
        update_happened = False
        watch_triggered = False
        async def watch():
            res = await client.get(f'/apiv1/1/watch/{initial_change_id}', headers={
                'Realtime-Graph-Session': session,
            })
            assert update_happened, "Watch returned before update happened!"
            json = await res.get_json()
            assert (new := json['changeId']) == initial_change_id + 1, f"New change id did not change: {new}"
            nonlocal watch_triggered
            watch_triggered = True
        _ = asyncio.create_task(watch())

        await asyncio.sleep(0.5)
        update_happened = True

        # Update should return a new state id and trigger old watches
        res = await client.post(f'/apiv1/1/update', json={
            'graphId': 1,
            'changeId': initial_change_id,
            'changed': {
                'nodes': [{
                    'id': 1,
                    'text': 'new_text',
                    'pos': [0, 0],
                    'dims': [1, 1],
                }],
            },
        }, headers={
            'Realtime-Graph-Session': session,
        })
        assert res.status_code == 200, f"Update failed: {await res.get_data()}"
        json = await res.get_json()
        assert json['changeId'] == initial_change_id + 1

        await asyncio.sleep(0.5)
        assert watch_triggered

        # Create node assigns ids
        res = await client.post(f'/apiv1/1/update', json={
            'graphId': 1,
            'changeId': 0,
            'changed': {
                'nodes': [{
                    'id': -1,
                    'text': 'client created node',
                    'pos': [0, 0],
                    'dims': [1, 1],
                }],
            },
        }, headers={
            'Realtime-Graph-Session': session,
        })
        assert res.status_code == 200, f"Failed to create node"
        change_id = (await res.get_json())['changeId']

        res = await client.get(f'/apiv1/1/watch/{change_id - 1}', headers={
            'Realtime-Graph-Session': session,
        })
        json = await res.get_json()
        assert isinstance(assigned_id := json['id_map']['-1'], int)
        assert assigned_id > 1

        # TODO: Old client specific ids are still respected

        # Get still works
        res = await client.get('/apiv1/1/get')
        assert res.status_code == 200
        json = await res.get_json()

        # Shutdown persistence works
        service_context.__exit__(None, None, None)

        with Session(e) as sess:
            node = sess.get(Node, assigned_id)
            assert node
            assert node.text == 'client created node'
