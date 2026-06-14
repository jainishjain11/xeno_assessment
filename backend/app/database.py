from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import Settings

settings = Settings()

# Async Engine (FastAPI)
engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

Base = declarative_base()

# Sync Engine (Celery) - lazy loaded to avoid startup crash
sync_engine = None
SyncSessionLocal = None

def get_sync_session():
    global sync_engine, SyncSessionLocal
    if sync_engine is None:
        from sqlalchemy import create_engine
        sync_url = settings.database_url.replace("postgresql+asyncpg", "postgresql+psycopg2")
        sync_engine = create_engine(sync_url, echo=False)
        SyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)
    return SyncSessionLocal()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session