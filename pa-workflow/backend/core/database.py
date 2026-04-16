from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import settings
from typing import AsyncGenerator

# --- PostgreSQL (SQLAlchemy) ---
async_engine = create_async_engine(
    str(settings.DATABASE_URL),
    pool_pre_ping=True,
    echo=settings.ENVIRONMENT == "dev",
)
AsyncSessionFactory = async_sessionmaker(
    async_engine,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get an async database session.
    """
    async with AsyncSessionFactory() as session:
        yield session

async def connect_db():
    """Connect to the PostgreSQL database."""
    # This is implicitly handled by the engine creation and first query.
    # A simple test query can be run here to confirm connection on startup.
    try:
        async with async_engine.connect() as conn:
            await conn.run_sync(lambda sync_conn: print("PostgreSQL connection successful."))
    except Exception as e:
        print(f"PostgreSQL connection failed: {e}")


async def disconnect_db():
    """Disconnect from the PostgreSQL database."""
    await async_engine.dispose()
    print("PostgreSQL connection closed.")


# --- MongoDB (Motor) ---
mongo_client: AsyncIOMotorClient | None = None

def get_mongo_client() -> AsyncIOMotorClient:
    """Get the MongoDB client."""
    if mongo_client is None:
        raise RuntimeError("MongoDB client not initialized. Call connect_mongo() first.")
    return mongo_client

async def get_mongo_db() -> AsyncIOMotorDatabase:
    """
    Dependency function to get the MongoDB database instance.
    """
    client = get_mongo_client()
    db_name = settings.MONGO_URI.split("/")[-1].split("?")[0]
    return client[db_name]

async def connect_mongo():
    """Connect to the MongoDB database."""
    global mongo_client
    mongo_client = AsyncIOMotorClient(settings.MONGO_URI)
    try:
        await mongo_client.admin.command('ping')
        print("MongoDB connection successful.")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")


async def disconnect_mongo():
    """Disconnect from the MongoDB database."""
    if mongo_client:
        mongo_client.close()
        print("MongoDB connection closed.")
