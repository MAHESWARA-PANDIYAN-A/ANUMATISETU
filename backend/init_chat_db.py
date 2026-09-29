import sys
import os
from sqlalchemy import text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, SessionLocal, Base
from app.models import (
    User, BusinessProfile, Document, Application,
    ChatSession, ChatMessage, ChatContext, AIRequestLog
)

def init_chat_tables():
    print("Creating/Verifying Chat & Assistant tables in PostgreSQL...")
    with SessionLocal() as db:
        try:
            db.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE messagerole AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            db.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE messagetype AS ENUM ('TEXT', 'ACTION', 'SYSTEM_CONTEXT');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            db.commit()
            print("Chat enums verified.")
        except Exception as e:
            db.rollback()
            print(f"Enum setup notice: {e}")

    Base.metadata.create_all(bind=engine)
    print("All chat tables initialized successfully.")

if __name__ == "__main__":
    init_chat_tables()
