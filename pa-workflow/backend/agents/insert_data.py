import asyncio
from datetime import datetime, timedelta, timezone
import random
from mongo_connection import get_db

# =========================
# SPECIALTIES
# =========================

SPECIALTIES = [
    "General",
    "Cardiology",
    "Orthopedics",
    "Radiology",
    "Neurology",
    "Oncology",
    "Emergency Medicine",
    "Dermatology",
    "Gastroenterology",
    "Pulmonology",
    "Ophthalmology",
    "Surgery",
    "Physical Therapy",
    "Psychiatry"
]

# =========================
# CPT CODES BY SPECIALTY
# =========================

CPT_CODES_BY_SPECIALTY = {
    "General": ["99213", "99214", "99215", "80053", "36415"],
    "Cardiology": ["93000", "93010", "93306", "99214", "99215"],
    "Orthopedics": ["27130", "20610", "29881", "99214", "99215"],
    "Radiology": ["70551", "71045", "70450", "99214", "99215"],
    "Neurology": ["95812", "99213", "99214", "99215"],
    "Oncology": ["96413", "99213", "99214", "99215"],
    "Emergency Medicine": ["99284", "99285", "99291"],
    "Dermatology": ["17000", "99213", "99214", "99215"],
    "Gastroenterology": ["45378", "43239", "99214", "99215"],
    "Pulmonology": ["94010", "99213", "99214", "99215"],
    "Ophthalmology": ["66984", "92012", "99214", "99215"],
    "Surgery": ["27130", "45378", "66984", "99214", "99215"],
    "Physical Therapy": ["97110", "97140", "99214"],
    "Psychiatry": ["90837", "90834", "99214"]
}

# =========================
# ICD-10 BY SPECIALTY
# =========================

ICD10_BY_SPECIALTY = {
    "General": ["I10", "E11.9", "N39.0"],
    "Cardiology": ["I10", "I25.10"],
    "Orthopedics": ["M54.5", "S72.001A"],
    "Radiology": ["R93.89", "Z01.89"],
    "Neurology": ["G43.909"],
    "Oncology": ["C50.919", "Z51.11"],
    "Emergency Medicine": ["R07.9", "S09.90XA"],
    "Dermatology": ["L20.9", "L70.0"],
    "Gastroenterology": ["K21.9"],
    "Pulmonology": ["J44.9"],
    "Ophthalmology": ["H25.13"],
    "Surgery": ["K35.80", "M16.11"],
    "Physical Therapy": ["M54.5"],
    "Psychiatry": ["F32.9"]
}

# =========================
# INSURANCE PLANS
# =========================

INSURANCE_PLANS = [
    {
        "plan_id": "HDFC_001",
        "plan_name": "HDFC Ergo Optima Secure",
        "payer": "HDFC Ergo"
    },
    {
        "plan_id": "ICICI_001",
        "plan_name": "ICICI Lombard Complete Health Insurance",
        "payer": "ICICI Lombard"
    },
    {
        "plan_id": "STAR_001",
        "plan_name": "Star Health Comprehensive Plan",
        "payer": "Star Health"
    }
]

# =========================
# OTHER CONSTANTS
# =========================

MODIFIERS = ["", "25", "59", "76", "77", "RT", "LT"]

PLACES_OF_SERVICE = ["11", "21", "22", "23", "24", "31"]

NETWORK_STATUSES = ["In-Network", "Out-of-Network"]

ADMISSION_TYPES = ["Elective", "Emergency", "Urgent"]

DISCHARGE_STATUSES = ["Home", "Transferred", "Expired", "AMA"]

STATUSES = ["APPROVED", "DENIED", "PENDING", "UNDER_REVIEW"]

FACILITY_TYPES = ["Hospital", "Clinic", "Office", "ER"]

# =========================
# PROVIDER GENERATION
# =========================

def generate_provider(provider_id, specialty, behavior="honest"):

    return {
        "provider_id": provider_id,
        "npi": f"NPI{random.randint(100000, 999999)}",
        "specialty": specialty,
        "behavior": behavior,
        "approval_ratio": round(
            random.uniform(0.75, 0.95)
            if behavior == "honest"
            else random.uniform(0.35, 0.75),
            2
        ),
        "average_billing": random.randint(1000, 5000),
        "location": random.choice(["Urban", "Rural"])
    }

# =========================
# PATIENT GENERATION
# =========================

def generate_patient(patient_id):

    age = random.randint(18, 85)
    gender = random.choice(["M", "F"])

    selected_plan = random.choice(INSURANCE_PLANS)

    specialty_for_conditions = random.choice(SPECIALTIES)

    chronic_conditions = random.sample(
        ICD10_BY_SPECIALTY[specialty_for_conditions],
        min(
            len(ICD10_BY_SPECIALTY[specialty_for_conditions]),
            random.randint(1, 2)
        )
    )

    return {
        "patient_id": patient_id,
        "member_id": f"PAT{patient_id:03d}",
        "age": age,
        "gender": gender,
        "chronic_conditions": chronic_conditions,

        "plan_id": selected_plan["plan_id"],
        "plan_name": selected_plan["plan_name"],
        "payer": selected_plan["payer"],

        "risk_score": round(random.uniform(0.1, 0.9), 2),
        "network_status": random.choice(NETWORK_STATUSES)
    }

# =========================
# FRAUD SCENARIOS
# =========================

def apply_fraud_scenario(claim, provider, scenario):

    if scenario == "duplicate":
        claim["fraud_flags"].append("DUPLICATE_CLAIM")
        claim["billed_amount"] *= 1.1

    elif scenario == "upcoding":
        claim["fraud_flags"].append("UPCODING")
        claim["cpt_codes"] = [
            code.replace("99213", "99215")
            for code in claim["cpt_codes"]
        ]
        claim["billed_amount"] *= 1.5

    elif scenario == "unbundling":
        claim["fraud_flags"].append("UNBUNDLING")

        extra_codes = random.sample(
            CPT_CODES_BY_SPECIALTY[provider["specialty"]],
            min(2, len(CPT_CODES_BY_SPECIALTY[provider["specialty"]]))
        )

        claim["cpt_codes"].extend(extra_codes)
        claim["billed_amount"] *= 1.3

    elif scenario == "excessive_repeat":
        claim["fraud_flags"].append("EXCESSIVE_REPEAT")
        claim["cpt_codes"] = [claim["cpt_codes"][0]] * 5
        claim["billed_amount"] *= 2

    elif scenario == "same_day_suspicious":
        claim["fraud_flags"].append("SAME_DAY_MULTIPLE")
        claim["claim_date"] = claim["claim_date"].replace(
            hour=random.randint(0, 23)
        )

    elif scenario == "phantom_billing":
        claim["fraud_flags"].append("PHANTOM_BILLING")
        claim["billed_amount"] = random.randint(10000, 50000)

    elif scenario == "mutually_exclusive":
        claim["fraud_flags"].append("MUTUALLY_EXCLUSIVE")
        claim["cpt_codes"].extend(["93000", "93306"])

    elif scenario == "outside_specialty":
        claim["fraud_flags"].append("OUTSIDE_SPECIALTY")

        other_specialty = random.choice(
            [s for s in SPECIALTIES if s != provider["specialty"]]
        )

        claim["cpt_codes"] = random.sample(
            CPT_CODES_BY_SPECIALTY[other_specialty],
            2
        )

    elif scenario == "billing_after_death":
        claim["fraud_flags"].append("BILLING_AFTER_DEATH")
        claim["diagnosis_codes"].append("DEATH_CERTIFIED")

    elif scenario == "weekend_spike":

        claim["fraud_flags"].append("WEEKEND_SPIKE")

        while claim["claim_date"].weekday() not in [5, 6]:
            claim["claim_date"] += timedelta(days=1)

        claim["billed_amount"] *= 1.2

# =========================
# CLAIM GENERATION
# =========================

def generate_claim(claim_id, patient, provider, base_date, fraud_scenario=None):

    specialty = provider["specialty"]

    cpt_codes = random.sample(
        CPT_CODES_BY_SPECIALTY[specialty],
        random.randint(1, min(3, len(CPT_CODES_BY_SPECIALTY[specialty])))
    )

    diagnosis_codes = random.sample(
        ICD10_BY_SPECIALTY[specialty],
        random.randint(1, min(2, len(ICD10_BY_SPECIALTY[specialty])))
    )

    billed_amount = sum(
        random.randint(500, 3000)
        for _ in cpt_codes
    )

    claim = {
        "claim_id": f"CLM{claim_id:04d}",

        "patient_member_id": patient["member_id"],

        "plan_id": patient["plan_id"],
        "plan_name": patient["plan_name"],
        "payer": patient["payer"],

        "provider_npi": provider["npi"],
        "provider_specialty": specialty,
        "provider_behavior": provider["behavior"],

        "claim_date": base_date + timedelta(
            days=random.randint(0, 90),
            hours=random.randint(8, 20)
        ),

        "cpt_codes": cpt_codes,

        "diagnosis_codes": diagnosis_codes,

        "modifier_codes": random.sample(
            MODIFIERS,
            random.randint(0, 2)
        ),

        "billed_amount": billed_amount,

        "status": random.choices(
            STATUSES,
            weights=[0.60, 0.20, 0.15, 0.05]
        )[0],

        "place_of_service": random.choice(PLACES_OF_SERVICE),

        "prior_auth_required": random.random() > 0.7,

        "prior_auth_approved": random.random() > 0.5,

        "facility_type": random.choice(FACILITY_TYPES),

        "admission_type": random.choice(ADMISSION_TYPES),

        "discharge_status": random.choice(DISCHARGE_STATUSES),

        "patient_age": patient["age"],
        "patient_gender": patient["gender"],

        "network_status": patient["network_status"],

        "fraud_flags": [],

        "risk_score": round(
            patient["risk_score"] + random.uniform(-0.1, 0.2),
            2
        )
    }

    if fraud_scenario:
        apply_fraud_scenario(claim, provider, fraud_scenario)

    claim["billed_amount"] = round(claim["billed_amount"], 2)

    return claim

# =========================
# MAIN INSERT FUNCTION
# =========================

async def insert_enhanced_data():

    db = get_db()

    col = db.claims_history

    # Clear old data
    await col.delete_many({})

    now = datetime.now(timezone.utc)

    base_date = now - timedelta(days=90)

    # =========================
    # GENERATE PROVIDERS
    # =========================

    providers = []

    for i in range(25):

        specialty = random.choice(SPECIALTIES)

        behavior = random.choices(
            ["honest", "aggressive", "fraudulent"],
            weights=[0.7, 0.2, 0.1]
        )[0]

        providers.append(
            generate_provider(
                provider_id=f"PROV{i+1:03d}",
                specialty=specialty,
                behavior=behavior
            )
        )

    # =========================
    # GENERATE PATIENTS
    # =========================

    patients = [
        generate_patient(i + 1)
        for i in range(60)
    ]

    # =========================
    # FRAUD SCENARIOS
    # =========================

    fraud_scenarios = [
        None,
        "duplicate",
        "upcoding",
        "unbundling",
        "excessive_repeat",
        "same_day_suspicious",
        "phantom_billing",
        "mutually_exclusive",
        "outside_specialty",
        "billing_after_death",
        "weekend_spike"
    ]

    # =========================
    # GENERATE CLAIMS
    # =========================

    claims = []

    for i in range(250):

        patient = random.choice(patients)

        provider = random.choice(providers)

        scenario = random.choices(
            fraud_scenarios,
            weights=[0.60] + [0.04] * 10
        )[0]

        claim = generate_claim(
            claim_id=i + 1,
            patient=patient,
            provider=provider,
            base_date=base_date,
            fraud_scenario=scenario
        )

        claims.append(claim)

    # =========================
    # INSERT INTO MONGODB
    # =========================

    await col.insert_many(claims)

    # =========================
    # SUMMARY
    # =========================

    print(f"\nInserted {len(claims)} claims successfully 🚀")

    print("\nDataset Summary:")
    print(f"Providers: {len(providers)}")
    print(f"Patients: {len(patients)}")
    print(f"Claims: {len(claims)}")

    fraud_count = sum(
        1 for claim in claims
        if claim["fraud_flags"]
    )

    print(f"Fraudulent Claims: {fraud_count}")

    status_distribution = {
        status: sum(
            1 for claim in claims
            if claim["status"] == status
        )
        for status in STATUSES
    }

    print(f"Status Distribution: {status_distribution}")

# =========================
# ENTRY POINT
# =========================

if __name__ == "__main__":
    asyncio.run(insert_enhanced_data())