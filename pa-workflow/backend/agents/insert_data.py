import asyncio
from datetime import datetime, timedelta, timezone
from mongo_connection import get_db


async def insert_data():
    db = get_db()
    col = db.claims_history

    # Optional: clear existing data (useful during testing)
    await col.delete_many({})

    now = datetime.now(timezone.utc)

    data = [

        # -------- NORMAL CLAIMS (baseline) -------- #
        {
            "claim_id": "CLM1",
            "patient_member_id": "PAT001",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=15),
            "cpt_codes": ["99213"],
            "billed_amount": 2000,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM2",
            "patient_member_id": "PAT001",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=14),
            "cpt_codes": ["99213"],
            "billed_amount": 2100,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM3",
            "patient_member_id": "PAT002",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=13),
            "cpt_codes": ["99213"],
            "billed_amount": 1900,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM4",
            "patient_member_id": "PAT003",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=12),
            "cpt_codes": ["99213"],
            "billed_amount": 2200,
            "status": "APPROVED"
        },

        # -------- DIFFERENT CPT (realism) -------- #
        {
            "claim_id": "CLM5",
            "patient_member_id": "PAT004",
            "provider_npi": "NPI124",
            "provider_specialty": "Cardiology",
            "claim_date": now - timedelta(days=10),
            "cpt_codes": ["93000"],
            "billed_amount": 3000,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM6",
            "patient_member_id": "PAT005",
            "provider_npi": "NPI124",
            "provider_specialty": "Cardiology",
            "claim_date": now - timedelta(days=9),
            "cpt_codes": ["93000"],
            "billed_amount": 3200,
            "status": "APPROVED"
        },

        # -------- DUPLICATE PATTERN -------- #
        {
            "claim_id": "CLM7",
            "patient_member_id": "PAT001",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=8),
            "cpt_codes": ["99213"],
            "billed_amount": 2050,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM8",
            "patient_member_id": "PAT001",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=7),
            "cpt_codes": ["99213"],
            "billed_amount": 2000,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM9",
            "patient_member_id": "PAT001",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=6),
            "cpt_codes": ["99213"],
            "billed_amount": 2100,
            "status": "APPROVED"
        },

        # -------- HIGH BILLING (upcoding) -------- #
        {
            "claim_id": "CLM10",
            "patient_member_id": "PAT006",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=5),
            "cpt_codes": ["99213"],
            "billed_amount": 18000,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM11",
            "patient_member_id": "PAT007",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=4),
            "cpt_codes": ["99213"],
            "billed_amount": 22000,
            "status": "APPROVED"
        },

        # -------- SAME DAY MULTIPLE CLAIMS -------- #
        {
            "claim_id": "CLM12",
            "patient_member_id": "PAT008",
            "provider_npi": "NPI125",
            "provider_specialty": "General",
            "claim_date": now,
            "cpt_codes": ["99213"],
            "billed_amount": 2000,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM13",
            "patient_member_id": "PAT009",
            "provider_npi": "NPI125",
            "provider_specialty": "General",
            "claim_date": now,
            "cpt_codes": ["99213"],
            "billed_amount": 2100,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM14",
            "patient_member_id": "PAT010",
            "provider_npi": "NPI125",
            "provider_specialty": "General",
            "claim_date": now,
            "cpt_codes": ["99213"],
            "billed_amount": 2200,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM15",
            "patient_member_id": "PAT011",
            "provider_npi": "NPI125",
            "provider_specialty": "General",
            "claim_date": now,
            "cpt_codes": ["99213"],
            "billed_amount": 2300,
            "status": "APPROVED"
        },
        {
            "claim_id": "CLM16",
            "patient_member_id": "PAT012",
            "provider_npi": "NPI125",
            "provider_specialty": "General",
            "claim_date": now,
            "cpt_codes": ["99213"],
            "billed_amount": 2400,
            "status": "APPROVED"
        },

        # -------- DENIED CLAIMS (provider risk) -------- #
        {
            "claim_id": "CLM17",
            "patient_member_id": "PAT013",
            "provider_npi": "NPI126",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=3),
            "cpt_codes": ["99213"],
            "billed_amount": 2000,
            "status": "DENIED"
        },
        {
            "claim_id": "CLM18",
            "patient_member_id": "PAT014",
            "provider_npi": "NPI126",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=2),
            "cpt_codes": ["99213"],
            "billed_amount": 2100,
            "status": "DENIED"
        },
        {
            "claim_id": "CLM19",
            "patient_member_id": "PAT015",
            "provider_npi": "NPI126",
            "provider_specialty": "General",
            "claim_date": now - timedelta(days=1),
            "cpt_codes": ["99213"],
            "billed_amount": 2200,
            "status": "APPROVED"
        },

        # -------- EXTREME FRAUD -------- #
        {
            "claim_id": "CLM20",
            "patient_member_id": "PAT001",
            "provider_npi": "NPI123",
            "provider_specialty": "General",
            "claim_date": now,
            "cpt_codes": ["99213"],
            "billed_amount": 50000,
            "status": "APPROVED"
        },
    ]

    await col.insert_many(data)
    print("Data inserted successfully.")


if __name__ == "__main__":
    asyncio.run(insert_data())