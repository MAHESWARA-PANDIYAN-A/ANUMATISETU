from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

import os

# Normalize Database URL for Render / PostgreSQL
db_url = settings.DATABASE_URL or ""
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# Test PostgreSQL connection; if unreachable (e.g. unconfigured localhost on Render), fallback to SQLite
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

try:
    if db_url.startswith("postgresql"):
        temp_engine = create_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
        with temp_engine.connect() as test_conn:
            test_conn.execute(text("SELECT 1"))
        engine = temp_engine
    else:
        engine = create_engine(db_url, connect_args=connect_args, pool_pre_ping=True)
except Exception as conn_err:
    logger.warning(f"Could not connect to PostgreSQL ({conn_err}). Falling back to local SQLite database.")
    db_url = "sqlite:///./tasker_platform.db"
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def check_db_connection() -> bool:
    """Verifies active connectivity to the configured database."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return False
