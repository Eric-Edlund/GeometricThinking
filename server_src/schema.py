from sqlalchemy.orm import DeclarativeBase, Session, Mapped, mapped_column
from sqlalchemy import Float, String, BigInteger, ForeignKey

class Base(DeclarativeBase): pass

class Node(Base):
    __tablename__ = 'Node'

    id: Mapped[int] = mapped_column(primary_key=True)
    context: Mapped[int] = mapped_column(ForeignKey('Node.id'), nullable=True)
    node_type: Mapped[str] = mapped_column(String(255), nullable=False)
    text: Mapped[str] = mapped_column(String(1024), nullable=False)


class Relation(Base):
    __tablename__ = 'NodeRelation'

    id: Mapped[int] = mapped_column(primary_key=True)
    rel_type: Mapped[str] = mapped_column(String(255), nullable=False)
    context: Mapped[int] = mapped_column(ForeignKey(Node.id), nullable=False)
    src: Mapped[int] = mapped_column(ForeignKey(Node.id), nullable=False)
    dest: Mapped[int] = mapped_column(ForeignKey(Node.id), nullable=False)


class NodePosition(Base):
    __tablename__ = 'NodePosition'

    id: Mapped[int] = mapped_column(primary_key=True)
    node: Mapped[int] = mapped_column(ForeignKey(Node.id), nullable=False)
    x: Mapped[int]  = mapped_column(Float, nullable=False)
    y: Mapped[int]  = mapped_column(Float, nullable=False)
