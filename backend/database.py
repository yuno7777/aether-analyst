"""
Database models and initialization for Aether Analyst.
Uses SQLAlchemy + SQLite.
"""

import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import sessionmaker, relationship, declarative_base

DATABASE_URL = "sqlite:///./aether_analyst.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True)
    title = Column(String, default="New Session")
    agent_mode = Column(String, default="combined")
    created_at = Column(DateTime, default=datetime.utcnow)

    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")
    runs = relationship("Run", back_populates="session", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'agent'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="messages")


class Run(Base):
    __tablename__ = "runs"

    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    agent_mode = Column(String, nullable=False)
    status = Column(String, default="running")  # 'running', 'completed', 'failed'
    created_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    report_id = Column(String, nullable=True)

    session = relationship("Session", back_populates="runs")
    report = relationship("Report", back_populates="run", uselist=False)


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True)
    run_id = Column(String, ForeignKey("runs.id"), nullable=True)
    title = Column(String, default="Untitled Report")
    agent_mode = Column(String, nullable=True)
    methodology = Column(Text, nullable=True)
    findings = Column(JSON, nullable=True)
    recommendations = Column(JSON, nullable=True)
    sources = Column(JSON, nullable=True)
    plots = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("Run", back_populates="report")


def init_db():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
