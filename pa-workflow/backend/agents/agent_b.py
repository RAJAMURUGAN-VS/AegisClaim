import psycopg2
from datetime import datetime

# ---------------- DB CONNECTION ---------------- #

def get_connection():
    return psycopg2.connect(
        "postgresql://neondb_owner:npg_jSTDn08loPFx@ep-flat-dew-ancpuyq8-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require"
    )


# ---------------- HELPER FUNCTIONS ---------------- #

def get_icd_code(diagnosis):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT icd_code, cpt_code FROM mapping WHERE LOWER(diagnosis) = LOWER(%s)",
        (diagnosis,)
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    if not rows:
        return None, []

    icd_code = rows[0][0]
    valid_procedures = [{"cpt_code": r[1]} for r in rows]

    return icd_code, valid_procedures


def get_plan(payer_name):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT plan_id, payer_id, coverage_limit, waiting_period_days, max_claims_per_year "
        "FROM plans WHERE LOWER(%s) LIKE LOWER(payer_id || '%%')",
        (payer_name,)
    )

    plan = cur.fetchone()

    cur.close()
    conn.close()

    if not plan:
        return None

    return {
        "plan_id": plan[0],
        "payer_id": plan[1],
        "coverage_limit": plan[2],
        "policy_rules": {
            "waiting_period_days": plan[3],
            "max_claims_per_year": plan[4]
        }
    }


def get_cpt_code(procedure):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT cpt_code FROM mapping WHERE LOWER(procedure_name) = LOWER(%s)",
        (procedure,)
    )

    row = cur.fetchone()

    cur.close()
    conn.close()

    return row[0] if row else None


def get_procedure_details(plan_id, cpt_code):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT max_cost FROM procedures WHERE plan_id = %s AND cpt_code = %s",
        (plan_id, cpt_code)
    )

    row = cur.fetchone()

    cur.close()
    conn.close()

    return row[0] if row else None


def check_claim_frequency(policy, history):
    max_claims = policy["policy_rules"]["max_claims_per_year"]
    return history.get("previous_claims", 0) < max_claims


def check_network_hospital(payer_id, hospital_name, location):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT name, city FROM hospitals WHERE LOWER(payer_id) = LOWER(%s)",
        (payer_id,)
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    hospital_lower = hospital_name.lower()
    location_lower = location.lower()

    for name, city in rows:
        if hospital_lower in name.lower() and city.lower() == location_lower:
            return "NETWORK"

    return "NON-NETWORK" if rows else "UNKNOWN"


def check_step_therapy(plan_id, procedure, history):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT required_prior FROM step_therapy WHERE plan_id = %s AND procedure_name = %s",
        (plan_id, procedure)
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    if not rows:
        return True, None

    required_steps = [r[0] for r in rows]
    past = [p.lower() for p in history.get("past_procedures", [])]

    missing = [r for r in required_steps if r.lower() not in past]

    return (False, missing) if missing else (True, None)


# ---------------- MAIN AGENT B FUNCTION ---------------- #

def agent_b_policy_check(claim):

    reasons = []
    decision = "APPROVED"

    # ---------------- 1. POLICY ACTIVE ---------------- #
    if not claim["policy"]["active"]:
        return {"decision": "REJECTED", "reason": "Policy inactive"}

    # ---------------- 2. DIAGNOSIS → ICD ---------------- #
    diagnosis = claim["medical"]["diagnosis"]
    icd_code, _ = get_icd_code(diagnosis)

    if not icd_code:
        return {"decision": "REJECTED", "reason": "Unknown diagnosis"}

    # ---------------- 3. PROCEDURE VALIDATION ---------------- #
    procedure = claim["medical"]["procedure"]
    cpt_code = get_cpt_code(procedure)

    if not cpt_code:
        reasons.append("Procedure not valid for diagnosis")
        decision = "REJECTED"

    # ---------------- 4. PLAN FETCH ---------------- #
    payer = claim["policy"]["insurance_company"]
    plan = get_plan(payer)

    if not plan:
        return {"decision": "REJECTED", "reason": "Plan not found"}

    # ---------------- 4b. STEP THERAPY ---------------- #
    history = claim.get("history", {})
    step_ok, missing_steps = check_step_therapy(plan["plan_id"], procedure, history)

    if not step_ok:
        reasons.append(f"Step therapy not completed. Required: {missing_steps}")
        if decision != "REJECTED":
            decision = "REVIEW"

    # ---------------- 5. HOSPITAL NETWORK CHECK ---------------- #
    hospital_name = claim.get("hospital", {}).get("name", "")
    hospital_location = claim.get("hospital", {}).get("location", "")

    hospital_status = check_network_hospital(
        plan["payer_id"], hospital_name, hospital_location
    )

    if hospital_status == "NON-NETWORK":
        reasons.append("Hospital not in network")
        if decision != "REJECTED":
            decision = "REVIEW"

    elif hospital_status == "UNKNOWN":
        return {"decision": "REJECTED", "reason": "Unknown hospital"}

    # ---------------- 6. COVERAGE CHECK ---------------- #
    max_cost = get_procedure_details(plan["plan_id"], cpt_code)

    if not max_cost:
        reasons.append("Procedure not covered in plan")
        decision = "REJECTED"

    # ---------------- 7. COST CHECK ---------------- #
    cost = claim.get("financial", {}).get("estimated_cost", 0)

    if max_cost and cost > max_cost:
        reasons.append("Cost exceeds limit")
        if decision != "REJECTED":
            decision = "REVIEW"

    # ---------------- 8. DOCUMENT CHECK ---------------- #
    required_docs = ["prescription", "lab_report", "scan_report"]
    user_docs = claim.get("documents", {})

    for doc in required_docs:
        if not user_docs.get(doc, False):
            reasons.append(f"Missing document: {doc}")
            if decision != "REJECTED":
                decision = "REVIEW"

    # ---------------- 9. CLAIM HISTORY CHECK ---------------- #
    if not check_claim_frequency(plan, history):
        reasons.append("Claim frequency exceeded")
        decision = "REJECTED"

    # ---------------- FINAL OUTPUT ---------------- #
    return {
        "decision": decision,
        "icd_code": icd_code,
        "cpt_code": cpt_code,
        "hospital_status": hospital_status,
        "reasons": reasons if reasons else ["All checks passed"]
    }


# ---------------- TEST BLOCK ---------------- #

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
            "estimated_cost": 1000000
        },
        "documents": {
            "prescription": True,
            "lab_report": True,
            "scan_report": True
        },
        "history": {
            "previous_claims": 1,
            "past_procedures": ["Physiotherapy", "Medication"]
        }
    }

    result = agent_b_policy_check(test_claim)
    print("\n RESULT:\n", result)