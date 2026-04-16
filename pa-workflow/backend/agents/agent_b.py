import json
import os
from datetime import datetime

# ---------------- LOAD DATASETS ---------------- #

# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "agentB dataset")

with open(os.path.join(DATASET_DIR, "mapping_dataset.json")) as f:
    mapping_data = json.load(f)

with open(os.path.join(DATASET_DIR, "planmaster_with_star.json")) as f:
    plan_data = json.load(f)["plans"]

with open(os.path.join(DATASET_DIR, "insurance_mock10000.json")) as f:
    history_data = json.load(f)

with open(os.path.join(DATASET_DIR, "network_hospitals.json")) as f:
    network_data = json.load(f)


# ---------------- HELPER FUNCTIONS ---------------- #

def get_icd_code(diagnosis):
    for item in mapping_data:
        if item["diagnosis"].lower() == diagnosis.lower():
            return item["icd10_code"], item["valid_procedures"]
    return None, []


def get_plan(payer_name):
    """Match payer by checking if any plan's payer_id is in the payer_name."""
    payer_lower = payer_name.lower()
    for plan in plan_data:
        # Check if plan's payer_id (e.g., 'hdfc') is contained in payer_name (e.g., 'hdfc ergo')
        if plan["payer_id"].lower() in payer_lower:
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
    """Check if hospital is in network. Allows partial name matching (e.g., 'Fortis' matches 'Fortis Hospital')."""
    payer_lower = payer_id.lower()
    hospital_lower = hospital_name.lower()
    location_lower = location.lower()

    for payer in network_data:
        # Check if payer's payer_id is contained in the provided payer_id
        if payer["payer_id"].lower() in payer_lower:
            for hospital in payer["network_hospitals"]:
                hosp_name_lower = hospital["name"].lower()
                hosp_location_lower = hospital["location"].lower()
                # Check for exact match or partial match (hospital name contains the input or vice versa)
                name_match = (hosp_name_lower == hospital_lower or
                             hospital_lower in hosp_name_lower or
                             hosp_name_lower in hospital_lower)
                location_match = hosp_location_lower == location_lower

                if name_match and location_match:
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

    # Map common variations of document keys
    doc_key_mapping = {
        "scan_report": ["scan_report", "scan"],
        "lab_report": ["lab_report", "lab"],
        "prescription": ["prescription"],
        "discharge_summary": ["discharge_summary", "discharge"]
    }

    for doc in required_docs:
        doc_present = False
        # Check all possible key variations for this document type
        possible_keys = doc_key_mapping.get(doc, [doc])
        for key in possible_keys:
            if user_docs.get(key, False):
                doc_present = True
                break
        if not doc_present:
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
        "hospital_status": hospital_status if hospital_status else "N/A",
        "reasons": reasons if reasons else ["All checks passed"]
    }


# ---------------- TEST BLOCK ---------------- #
if __name__ == "__main__":
    # Test with sample claims from the dataset
    print("Testing Agent B Policy Check...\n")

    for i, claim in enumerate(history_data[:3]):  # Test first 3 claims
        print(f"Claim {claim['claim_id']}: {claim['patient']['name']}")
        print(f"  Insurance: {claim['policy']['insurance_company']}")
        print(f"  Diagnosis: {claim['medical']['diagnosis']}")
        print(f"  Procedure: {claim['medical']['procedure']}")
        print(f"  Hospital: {claim['hospital']['name']}, {claim['hospital']['location']}")

        result = agent_b_policy_check(claim)
        print(f"  Result: {result}")
        print("-" * 50)
