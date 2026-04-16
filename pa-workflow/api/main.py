# FastAPI Main Application Entrypoint
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.database import connect_db, disconnect_db, connect_mongo, disconnect_mongo
from core.redis_client import connect_redis, disconnect_redis
from models.mongo_models import create_indexes
from core.config import settings
from .routes import auth_routes
try:
    from .routes import pa_routes
except ImportError:
    pa_routes = None  # pa_routes has dependencies that may not be fully configured

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handle application startup and shutdown events.
    """
    await connect_db()
    await connect_mongo()
    await connect_redis()
    
    # Create MongoDB indexes
    # This needs a bit of a workaround to get the db instance during startup
    from core.database import get_mongo_client
    mongo_client = get_mongo_client()
    db_name = settings.MONGO_URI.split("/")[-1].split("?")[0]
    mongo_db = mongo_client[db_name]
    await create_indexes(mongo_db)

    yield
    await disconnect_db()
    await disconnect_mongo()
    await disconnect_redis()

app = FastAPI(
    title="AI-Powered Prior Authorization Workflow",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to the AI-Powered Prior Authorization API"}

# Mount routers here
if pa_routes:
    app.include_router(pa_routes.router, prefix="/api/v1", tags=["Prior Authorization"])
app.include_router(auth_routes.router, prefix="/api/v1", tags=["Authentication"])
# app.include_router(webhook_routes.router, prefix="/api/v1/webhooks", tags=["Webhooks"])
