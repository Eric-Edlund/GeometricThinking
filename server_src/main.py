from flask import Flask
from sqlalchemy import Engine, create_engine, MetaData, select, func
from sqlalchemy.orm import Session
from schema import Base, Node
from flask import Flask
from flask_cors import CORS
from server_bp import RealtimeGraphServer


def insert_synthetic(e: Engine):
    with Session(e) as sess:
        def n(ty, text):
            return Node(
                x=0,
                y=0,
                width=1,
                height=1,
                text=text,
            )

        sess.add_all([
            f0 := n('Fact', 
              'As of 2025-2-23, DOGE has saved 51 billion dollars.\nhttps://dogegov.com/dogeclock'
              ),
            f1 := n('Fact',
              'America has 340 million people.\nhttps://www.google.com/search?client=firefox-b-1-d&q=population+of+America'
            ),
            d0 := n('Deduction',
              'DOGE has saved $345.35 per tax payer.',
            ),
            n('Opinion',
              'Many of the cuts were stuff we wanted.'
            ),
        ])
        sess.commit()


def main():
    e = create_engine('sqlite:///data.db')
    Base.metadata.create_all(bind=e)

    with Session(e) as sess:
        node = sess.scalar(select(Node).limit(1))
        if node is None:
            print("Building synthetic data.")
            insert_synthetic(e)

    m = MetaData()
    m.reflect(bind=e)
    print(m.tables.keys())

    app = Flask(__name__)

    service = RealtimeGraphServer(e)
    app.register_blueprint(service, url_prefix="/apiv1")

    cors = CORS(app, resources={r"*": {"origins": "*"}}) # allow CORS for all domains on all routes.
    app.config['CORS_HEADERS'] = 'Content-Type'

    app.run(debug=True)


if __name__ == '__main__':
    main()
