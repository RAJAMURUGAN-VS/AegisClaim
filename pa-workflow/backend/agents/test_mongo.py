import asyncio
from mongo_connection import get_db

async def test():
    db = get_db()
    
    collections = await db.list_collection_names()
    print("✅ Connected successfully!")
    print("Collections:", collections)

asyncio.run(test())