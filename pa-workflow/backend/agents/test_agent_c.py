import asyncio
from uuid import uuid4
from agents.mongo_connection import get_db
from agents.agent_c import FraudAnomalyAgent

# Dummy placeholders (you already have these in your project)
db_session = None  # you can mock this for now
payer_id = uuid4()

async def test():
    mongo_db = get_db()

    agent = FraudAnomalyAgent(
        mongo_db=mongo_db,
        db_session=db_session,
        payer_id=payer_id
    )

    result = await agent.analyze(
        pa_id=uuid4(),
        patient_member_id="PAT001",
        provider_npi="NPI123",
        cpt_codes=["99213"],
        billed_amount=20000,  
        provider_specialty="General"
    )

    print(result)

asyncio.run(test())