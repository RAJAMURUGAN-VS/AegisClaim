# FastAPI Main Application Entrypoint
from fastapi import FastAPI
from contextlib import asynccontextmanager
from ..core.database import connect_db, disconnect_db, connect_mongo, disconnect_mongo, get_mongo_db
from ..core.redis_client import connect_redis, disconnect_redis
from ..models.mongo_models import create_indexes

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handle application startup and shutdown events.
    """
    await connect_db()
    await connect_mongo()
    await connect_redis()
    
    # Create MongoDB indexes
    mongo_db = await get_mongo_db()
    await create_indexes(mongo_db)

    yield
    await disconnect_db()
    await disconnect_mongo()
    await disconnect_redis()

app = FastAPI(
    title="AI-Powered Prior Authorization Workflow",
    lifespan=lifespan
)

@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the AI-Powered Prior Authorization API"}

# Mount routers here
# from .routes import pa_routes, webhook_routes
# app.include_router(pa_routes.router, prefix="/api/v1", tags=["Prior Authorization"])
# app.include_router(webhook_routes.router, prefix="/api/v1/webhooks", tags=["Webhooks"])
