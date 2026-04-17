import psycopg2
import os
from dotenv import load_dotenv

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

def get_icd_code(diagnosis):
    rows = execute_query(
        "SELECT icd_code, cpt_code FROM mapping WHERE LOWER(diagnosis) = LOWER(%s)",
        (diagnosis,),
        fetchall=True
    )

    if not rows:
        return None, []

    icd_code = rows[0][0]
    valid_procedures = [{"cpt_code": r[1]} for r in rows]

    return icd_code, valid_procedures


def get_plan(payer_name):
    plan = execute_query(
        """
        SELECT plan_id, plan_name, payer_id, coverage_limit, waiting_period_days, max_claims_per_year
        FROM plans
        WHERE LOWER(%s) LIKE LOWER(payer_id || '%%')
        """,
        (payer_name,),
        fetchone=True
    )

    if not plan:
        return None

    return {
        "plan_id": plan[0],
        "plan_name": plan[1],
        "payer_id": plan[2],
        "coverage_limit": plan[3],
        "policy_rules": {
            "waiting_period_days": plan[4],
            "max_claims_per_year": plan[5]
        }
    }


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


def check_claim_frequency(policy, history):
    max_claims = policy["policy_rules"]["max_claims_per_year"]
    return history.get("previous_claims", 0) < max_claims


def check_network_hospital(payer_id, hospital_name, location):
    rows = execute_query(
        "SELECT name, city FROM hospitals WHERE LOWER(payer_id) = LOWER(%s)",
        (payer_id,),
        fetchall=True
    )

    hospital_lower = hospital_name.lower()
    location_lower = location.lower()

    for name, city in rows:
        if hospital_lower in name.lower() and city.lower() == location_lower:
            return "NETWORK"

    return "NON-NETWORK" if rows else "UNKNOWN"


def check_step_therapy(plan_id, procedure, history):
    rows = execute_query(
        "SELECT required_prior FROM step_therapy WHERE plan_id = %s AND procedure_name = %s",
        (plan_id, procedure),
        fetchall=True
    )

    if not rows:
        return True, None

    required_steps = [r[0] for r in rows]
    past = [p.lower() for p in history.get("past_procedures", [])]

    missing = [r for r in required_steps if r.lower() not in past]

    return (False, missing) if missing else (True, None)


# ---------------- MAIN AGENT ---------------- #

def agent_b_policy_check(claim):

    reasons = []
    decision = "APPROVED"

    # 1. POLICY ACTIVE
    if not claim["policy"]["active"]:
        return {"decision": "REJECTED", "reason": "Policy inactive"}

    # 2. DIAGNOSIS
    diagnosis = claim["medical"]["diagnosis"]
    icd_code, _ = get_icd_code(diagnosis)

    if not icd_code:
        return {"decision": "REJECTED", "reason": "Unknown diagnosis"}

    # 3. PROCEDURE
    procedure = claim["medical"]["procedure"]
    cpt_code = get_cpt_code(procedure)

    if not cpt_code:
        reasons.append("Procedure not valid for diagnosis")
        decision = "REJECTED"

    # 4. PLAN
    payer = claim["policy"]["insurance_company"]
    plan = get_plan(payer)

    if not plan:
        return {"decision": "REJECTED", "reason": "Plan not found"}

    # 4b. STEP THERAPY
    history = claim.get("history", {})
    step_ok, missing_steps = check_step_therapy(plan["plan_id"], procedure, history)

    if not step_ok:
        reasons.append(f"Step therapy not completed. Required: {missing_steps}")
        if decision != "REJECTED":
            decision = "REVIEW"

    # 5. HOSPITAL
    hospital = claim.get("hospital", {})
    hospital_status = check_network_hospital(
        plan["payer_id"],
        hospital.get("name", ""),
        hospital.get("location", "")
    )

    if hospital_status == "NON-NETWORK":
        reasons.append("Hospital not in network")
        if decision != "REJECTED":
            decision = "REVIEW"
    elif hospital_status == "UNKNOWN":
        return {"decision": "REJECTED", "reason": "Unknown hospital"}

    # 6. COVERAGE
    max_cost = get_procedure_details(plan["plan_id"], cpt_code)

    if not max_cost:
        reasons.append("Procedure not covered in plan")
        decision = "REJECTED"

    # 7. COST
    cost = claim.get("financial", {}).get("estimated_cost", 0)

    if max_cost and cost > max_cost:
        reasons.append("Cost exceeds limit")
        if decision != "REJECTED":
            decision = "REVIEW"

    # 8. DOCUMENTS
    required_docs = ["prescription", "lab_report", "scan_report"]
    user_docs = claim.get("documents", {})

    for doc in required_docs:
        if not user_docs.get(doc, False):
            reasons.append(f"Missing document: {doc}")
            if decision != "REJECTED":
                decision = "REVIEW"

    # 9. CLAIM FREQUENCY
    if not check_claim_frequency(plan, history):
        reasons.append("Claim frequency exceeded")
        decision = "REJECTED"

    # FINAL OUTPUT
    return {
        "decision": decision,
        "plan": {
            "id": plan["plan_id"],
            "name": plan["plan_name"]
        },
        "medical": {
            "icd_code": icd_code,
            "cpt_code": cpt_code
        },
        "hospital_status": hospital_status,
        "reasons": reasons if reasons else ["All checks passed"]
    }


# ---------------- TEST ---------------- #

if __name__ == "__main__":

    test_claim = {
        "policy": {
            "active": True,
            "insurance_company": "HDFC"
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
            "lab_report": False,
            "scan_report": True
        },
        "history": {
            "previous_claims": 1,
            "past_procedures": ["Physiotherapy", "Medication"]
        }
    }

    result = agent_b_policy_check(test_claim)
    print("\n RESULT:\n", result)