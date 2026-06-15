import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.database import Base
import app.models
import os

async def create_tables():
    engine = create_async_engine(
        os.environ['DATABASE_URL'],
        connect_args={'statement_cache_size': 0, 'prepared_statement_cache_size': 0}
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print('All tables created successfully!')

asyncio.run(create_tables())