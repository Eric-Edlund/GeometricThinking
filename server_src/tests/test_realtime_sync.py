import unittest
from quart import Quart
from sqlalchemy import Engine, create_engine, MetaData, select, func
from sqlalchemy.orm import Session
from schema import Base, Node
from quart_cors import cors
from server_bp import RealtimeGraphServer
from main import insert_synthetic
import asyncio


def actually_not_async(fn):
    def res(*args, **kwargs):
        return asyncio.run(fn(*args, **kwargs))

    return res


class Test(unittest.TestCase):
    @actually_not_async
    async def test_sync(self):
        e = create_engine('sqlite:///data.db')
        Base.metadata.create_all(bind=e)
        insert_synthetic(e)
        m = MetaData()
        m.reflect(bind=e)
        app = Quart(__name__)
        service = RealtimeGraphServer(e)
        app.register_blueprint(service, url_prefix="/apiv1")
        _ = cors(app)
        app.config['CORS_HEADERS'] = 'Content-Type'

        client = app.test_client()

        # Get works
        res = await client.get('/apiv1/1/get')
        assert res.status_code == 200
        json = await res.get_json()

        initial_change_id = json['changeId']
        print('changeid:', initial_change_id)

        # Watch of old state id returns immediately
        res = await client.get(f'/apiv1/1/watch/{initial_change_id - 1}')
        assert res.status_code == 200
        json = await res.get_json()
        assert json['changeId'] == initial_change_id

        # Watch of current state id blocks until there is an update
        update_happened = False
        watch_triggered = False
        async def watch():
            res = await client.get(f'/apiv1/1/watch/{initial_change_id}')
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
        })
        assert res.status_code == 200, f"Update failed: {await res.get_data()}"
        json = await res.get_json()
        assert json['changeId'] == initial_change_id + 1

        await asyncio.sleep(0.5)
        assert watch_triggered

        assert False

