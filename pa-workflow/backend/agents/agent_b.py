import json
from datetime import datetime

# ---------------- LOAD DATASETS ---------------- #

with open("mapping_dataset.json") as f:
    mapping_data = json.load(f)

with open("planmaster_with_star.json") as f:
    plan_data = json.load(f)["plans"]

with open("insurance_mock10000.json") as f:
    history_data = json.load(f)

with open("network_hospitals.json") as f:
    network_data = json.load(f)


# ---------------- HELPER FUNCTIONS ---------------- #

def get_icd_code(diagnosis):
    for item in mapping_data:
        if item["diagnosis"].lower() == diagnosis.lower():
            return item["icd10_code"], item["valid_procedures"]
    return None, []


def get_plan(payer_name):
    for plan in plan_data:
        if payer_name.lower() in plan["payer_id"].lower():
            return plan
    return None


def get_cpt_code(procedure, valid_procedures):
    for proc in valid_procedures:
        if proc["name"].lower() == procedure.lower():
            return proc["cpt_code"]
    return None


def check_claim_frequency(policy, history):
    max_claims = policy["policy_rules"]["max_claims_per_year"]
    return history["previous_claims"] < max_claims



def check_network_hospital(payer_id, hospital_name, location):
    for payer in network_data:
        if payer["payer_id"].lower() == payer_id.lower():
            for hospital in payer["network_hospitals"]:
                if (
                    hospital["name"].lower() == hospital_name.lower()
                    and hospital["location"].lower() == location.lower()
                ):
                    return "NETWORK"
            return "NON-NETWORK"
    return "UNKNOWN"


# ---------------- MAIN AGENT B FUNCTION ---------------- #

def agent_b_policy_check(claim):

    reasons = []
    decision = "APPROVED"

    # ---------------- 1. POLICY ACTIVE ---------------- #
    if not claim["policy"]["active"]:
        return {"decision": "REJECTED", "reason": "Policy inactive"}

    # ---------------- 2. DIAGNOSIS → ICD ---------------- #
    diagnosis = claim["medical"]["diagnosis"]
    icd_code, valid_procedures = get_icd_code(diagnosis)

    if not icd_code:
        return {"decision": "REJECTED", "reason": "Unknown diagnosis"}

    # ---------------- 3. PROCEDURE VALIDATION ---------------- #
    procedure = claim["medical"]["procedure"]
    cpt_code = get_cpt_code(procedure, valid_procedures)

    if not cpt_code:
        reasons.append("Procedure not valid for diagnosis")
        decision = "REJECTED"

    # ---------------- 4. PLAN FETCH ---------------- #
    payer = claim["policy"]["insurance_company"]
    plan = get_plan(payer)

    if not plan:
        return {"decision": "REJECTED", "reason": "Plan not found"}

    # ---------------- 5. 🏥 HOSPITAL NETWORK CHECK ---------------- #
    hospital_name = claim["hospital"]["name"]
    hospital_location = claim["hospital"]["location"]

    hospital_status = check_network_hospital(
        payer, hospital_name, hospital_location
    )

    if hospital_status == "NON-NETWORK":
        reasons.append("Hospital is not in insurer network (reimbursement case)")
        decision = "REVIEW"

    elif hospital_status == "UNKNOWN":
        return {"decision": "REJECTED", "reason": "Unknown hospital"}

    # ---------------- 6. COVERAGE CHECK ---------------- #
    covered = False
    max_cost = None

    for proc in plan["procedures"]:
        if proc["cpt_code"] == cpt_code:
            covered = True
            max_cost = proc["max_cost"]

    if not covered:
        reasons.append("Procedure not covered in plan")
        decision = "REJECTED"

    # ---------------- 7. COST CHECK ---------------- #
    cost = claim["financial"]["estimated_cost"]

    if max_cost and cost > max_cost:
        reasons.append("Cost exceeds limit")
        decision = "REVIEW"

    # ---------------- 8. DOCUMENT CHECK ---------------- #
    required_docs = plan["documents_required"]
    user_docs = claim["documents"]

    for doc in required_docs:
        if not user_docs.get(doc, False):
            reasons.append(f"Missing document: {doc}")
            decision = "REVIEW"

    # ---------------- 9. CLAIM HISTORY CHECK ---------------- #
    history = claim["history"]

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
