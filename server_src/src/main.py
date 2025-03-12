from quart import Quart
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from quart_cors import cors
from tests.utils.synthetic_data import insert_synthetic
import asyncio

from src.realtime_server import RealtimeGraphServer
from src.schema import Base, Node


def main():
    e = create_engine('sqlite:///data.db')
    Base.metadata.create_all(bind=e)

    with Session(e) as sess:
        node = sess.scalar(select(Node).limit(1))
        if node is None:
            print("Building synthetic data.")
            insert_synthetic(e)
        sess.commit()

    app = Quart(__name__)

    with Session(e) as sess:
        with RealtimeGraphServer(sess) as service:
            app.register_blueprint(service, url_prefix="/apiv1")

            _ = cors(app)
            app.config['CORS_HEADERS'] = 'Content-Type'

            app.run(debug=True, loop=asyncio.get_event_loop())
