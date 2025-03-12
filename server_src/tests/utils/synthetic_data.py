from sqlalchemy import Engine
from sqlalchemy.orm import Session
from src.schema import Node

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


def new_test_node():
    return Node(
        x=0,
        y=0,
        width=1,
        height=1,
        text='test data',
    )
