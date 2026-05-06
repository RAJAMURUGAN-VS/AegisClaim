import psycopg2
import os
from dotenv import load_dotenv
from datetime import datetime

# ---------------- LOAD ENV ---------------- #
load_dotenv()

# ---------------- DB CONNECTION ---------------- #
def get_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"))

# ---------------- GENERIC DB EXECUTOR ---------------- #
def execute_query(query, params=(), fetchone=False, fetchall=False):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(query, params)

    result = None
    if fetchone:
        result = cur.fetchone()
    elif fetchall:
        result = cur.fetchall()

    cur.close()
    conn.close()
    return result

# ---------------- HELPER FUNCTIONS ---------------- #

def get_user_policy(policy_number):
    row = execute_query(
        """
        SELECT plan_id, start_date, end_date, sum_insured, used_amount
        FROM user_policies
        WHERE policy_number = %s
        """,
        (policy_number,),
        fetchone=True
    )

    if not row:
        return None

    return {
        "plan_id": row[0],
        "start_date": row[1],
        "end_date": row[2],
        "sum_insured": row[3],
        "used_amount": row[4]
    }


def get_plan_by_id(plan_id):
    row = execute_query(
        """
        SELECT plan_id, plan_name, payer_id, coverage_limit, max_claims_per_year
        FROM plans
        WHERE plan_id = %s
        """,
        (plan_id,),
        fetchone=True
    )

    if not row:
        return None

    return {
        "plan_id": row[0],
        "plan_name": row[1],
        "payer_id": row[2],
        "coverage_limit": row[3],
        "max_claims_per_year": row[4]
    }


def get_icd_code(diagnosis):
    row = execute_query(
        "SELECT icd_code FROM mapping WHERE LOWER(diagnosis) = LOWER(%s)",
        (diagnosis,),
        fetchone=True
    )
    return row[0] if row else None


def get_cpt_code(procedure):
    row = execute_query(
        "SELECT cpt_code FROM mapping WHERE LOWER(procedure_name) = LOWER(%s)",
        (procedure,),
        fetchone=True
    )
    return row[0] if row else None


def get_procedure_details(plan_id, cpt_code):
    row = execute_query(
        "SELECT max_cost FROM procedures WHERE plan_id = %s AND cpt_code = %s",
        (plan_id, cpt_code),
        fetchone=True
    )
    return row[0] if row else None


def is_excluded_procedure(plan_id, procedure):
    row = execute_query(
        """
        SELECT category, reason FROM excluded_procedures
        WHERE plan_id = %s AND LOWER(procedure_name) = LOWER(%s)
        """,
        (plan_id, procedure),
        fetchone=True
    )
    return row if row else None


def check_waiting_period(plan_id, disease, start_date):
    row = execute_query(
        """
        SELECT waiting_days FROM waiting_periods
        WHERE plan_id = %s AND LOWER(disease_name) = LOWER(%s)
        """,
        (plan_id, disease),
        fetchone=True
    )

    if not row:
        return True

    waiting_days = row[0]
    today = datetime.today().date()
    days_passed = (today - start_date).days

    return days_passed >= waiting_days


def check_network_hospital(payer_id, hospital_name, location):
    rows = execute_query(
        "SELECT name, city FROM hospitals WHERE LOWER(payer_id) = LOWER(%s)",
        (payer_id,),
        fetchall=True
    )

    for name, city in rows:
        if hospital_name.lower() in name.lower() and city.lower() == location.lower():
            return "NETWORK"

    return "NON-NETWORK" if rows else "UNKNOWN"


def check_claim_frequency(max_claims, history):
    return history.get("previous_claims", 0) < max_claims


def check_step_therapy(plan_id, procedure, history):
    rows = execute_query(
        "SELECT required_prior FROM step_therapy WHERE plan_id = %s AND procedure_name = %s",
        (plan_id, procedure),
        fetchall=True
    )

    if not rows:
        return True, None

    required = [r[0] for r in rows]
    past = [p.lower() for p in history.get("past_procedures", [])]

    missing = [r for r in required if r.lower() not in past]

    return (False, missing) if missing else (True, None)


# ---------------- MAIN AGENT ---------------- #

def agent_b_policy_check(claim):

    reasons = []
    decision = "APPROVED"

    # 1. POLICY FETCH
    policy_number = claim["policy"]["policy_number"]
    policy = get_user_policy(policy_number)

    if not policy:
        return {"decision": "REJECTED", "reason": "Invalid policy number"}

    # 2. PLAN FETCH
    plan = get_plan_by_id(policy["plan_id"])

    if not plan:
        return {"decision": "REJECTED", "reason": "Plan not found"}

    # 3. POLICY VALIDITY
    today = datetime.today().date()

    if today > policy["end_date"]:
        return {"decision": "REJECTED", "reason": "Policy expired"}

    if policy["used_amount"] >= policy["sum_insured"]:
        return {"decision": "REJECTED", "reason": "Coverage exhausted"}

    # 4. DIAGNOSIS
    diagnosis = claim["medical"]["diagnosis"]
    icd_code = get_icd_code(diagnosis)

    if not icd_code:
        return {"decision": "REJECTED", "reason": "Unknown diagnosis"}

    # 5. PROCEDURE
    procedure = claim["medical"]["procedure"]
    cpt_code = get_cpt_code(procedure)

    if not cpt_code:
        return {"decision": "REJECTED", "reason": "Invalid procedure"}

    # 6. EXCLUSION CHECK 
    excluded = is_excluded_procedure(plan["plan_id"], procedure)
    if excluded:
        return {
            "decision": "REJECTED",
            "reason": excluded[1],
            "category": excluded[0]
        }

    # 7. WAITING PERIOD 
    if not check_waiting_period(plan["plan_id"], diagnosis, policy["start_date"]):
        return {"decision": "REJECTED", "reason": "Waiting period not completed"}

    # 8. STEP THERAPY
    history = claim.get("history", {})
    step_ok, missing = check_step_therapy(plan["plan_id"], procedure, history)

    if not step_ok:
        reasons.append(f"Step therapy missing: {missing}")
        decision = "REVIEW"

    # 9. HOSPITAL
    hospital = claim.get("hospital", {})
    hospital_status = check_network_hospital(
        plan["payer_id"],
        hospital.get("name", ""),
        hospital.get("location", "")
    )

    if hospital_status == "NON-NETWORK":
        reasons.append("Hospital not in network")
        decision = "REVIEW"
    elif hospital_status == "UNKNOWN":
        return {"decision": "REJECTED", "reason": "Unknown hospital"}

    # 10. COST
    max_cost = get_procedure_details(plan["plan_id"], cpt_code)
    cost = claim.get("financial", {}).get("estimated_cost", 0)

    if not max_cost:
        return {"decision": "REJECTED", "reason": "Procedure not covered"}

    if cost > max_cost:
        reasons.append("Cost exceeds limit")
        decision = "REVIEW"

    # 11. DOCUMENTS
    required_docs = ["prescription", "lab_report", "scan_report"]
    user_docs = claim.get("documents", {})

    for doc in required_docs:
        if not user_docs.get(doc, False):
            reasons.append(f"Missing document: {doc}")
            decision = "REVIEW"

    # 12. CLAIM FREQUENCY
    if not check_claim_frequency(plan["max_claims_per_year"], history):
        return {"decision": "REJECTED", "reason": "Claim frequency exceeded"}

    return {
        "decision": decision,
        "plan_name": plan["plan_name"],
        "icd_code": icd_code,
        "cpt_code": cpt_code,
        "hospital_status": hospital_status,
        "reasons": reasons if reasons else ["All checks passed"]
    }


# ---------------- TEST ---------------- #

if __name__ == "__main__":

    test_claim = {
        "policy": {
            "policy_number": "POLHDFC1001"
        },
        "medical": {
            "diagnosis": "Fracture",
            "procedure": "Surgery"
        },
        "hospital": {
            "name": "Apollo Hospital",
            "location": "Chennai"
        },
        "financial": {
            "estimated_cost": 100000
        },
        "documents": {
            "prescription": True,
            "lab_report": True,
            "scan_report": True
        },
        "history": {
            "previous_claims": 1,
            "past_procedures": ["Physiotherapy"]
        }
    }

    result = agent_b_policy_check(test_claim)
    print("\nRESULT:\n", result)