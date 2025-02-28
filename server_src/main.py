from flask import Flask, jsonify
from sqlalchemy import Engine, create_engine, select, MetaData
from sqlalchemy.orm import Session
from schema import Base, Node, Relation
from flask import Flask
from flask_cors import CORS, cross_origin

def construct_app(engine: Engine) -> Flask:
    app = Flask(__name__)


    @cross_origin()
    @app.get('/view/<graph_id>')
    def get_graph(graph_id: int):
        '''graph id is the graphs root (context) node.'''

        with Session(engine) as sess:
            root = sess.scalar(select(Node).where(
                Node.id == graph_id
            ))
            if root == None:
                return jsonify({
                    'status': 'error',
                    'reason': f'Graph with id {graph_id} not found.'
                }), 404

            direct_children = sess.scalars(select(Node).where(
                Node.context == graph_id
            ))

            rels = sess.scalars(select(Relation).where(
                Relation.context == graph_id
            ))

            return jsonify({
                'status': 'ok',
                'nodes': [{
                    'id': n.id,
                    'type': n.node_type,
                    'text': n.text,
                } for n in direct_children],
                'rels': [{
                    'src': r.src,
                    'dest': r.dest,
                } for r in rels],
            })

    return app


def insert_synthetic(e: Engine):
    with Session(e) as sess:
        sess.add(root := Node(
            node_type='Question',
            text='Is DOGE bad for the country?'
        ))
        sess.commit()

        print('Created synthetic graph', root.id)
        assert root.id

        def n(ty, text):
            return Node(
                context=root.id,
                node_type=ty,
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

        def r(ty, a: Node, b: Node):
            return Relation(
                context=root.id,
                rel_type=ty,
                src=a.id,
                dest=b.id,
            )

        sess.add_all([
            r('TruthDependence', f0, d0),
            r('TruthDependence', f1, d0),
        ])

        sess.commit()


def main():
    e = create_engine('sqlite:///data.db')
    Base.metadata.create_all(bind=e)

    insert_synthetic(e)

    m = MetaData()
    m.reflect(bind=e)
    print(m.tables.keys())


    app = construct_app(e)

    cors = CORS(app) # allow CORS for all domains on all routes.
    app.config['CORS_HEADERS'] = 'Content-Type'

    app.run(debug=True)


if __name__ == '__main__':
    main()
