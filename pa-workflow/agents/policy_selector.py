import logging
from uuid import UUID
from typing import List, Dict, Any
from pathlib import Path

# Placeholder for a more complex policy selector agent
# In a real system, this would query a database or a rules engine.

logger = logging.getLogger(__name__)

class PolicySelectorAgent:
    """
    Agent responsible for initial policy selection and document validation.
    """
    def __init__(self):
        # In a real implementation, this might load rules from a database.
        self.plan_rules = {
            "plan-abc-123": {"pa_required": True, "required_docs": ["clinical_notes", "prescription"]},
            "plan-xyz-789": {"pa_required": False, "required_docs": []},
        }

    def check_policy_and_documents(self, plan_id: str, submitted_docs: List[str]) -> Dict[str, Any]:
        """
        Checks if PA is required and if all necessary documents are submitted.
        """
        logger.info(f"Checking policy for plan_id: {plan_id}")
        
        normalized_docs = [Path(doc).stem.lower() for doc in submitted_docs]
        rules = self.plan_rules.get(str(plan_id))
        if not rules:
            # Default to PA required for unknown plans, but do not hard-block when files were submitted.
            missing = [] if normalized_docs else ["clinical_notes"]
            return {"pa_required": True, "missing_documents": missing, "document_checklist": ["clinical_notes", "prescription"]}

        if not rules["pa_required"]:
            return {"pa_required": False, "missing_documents": []}

        # Check for missing documents (simplified logic)
        missing = [doc for doc in rules["required_docs"] if doc not in normalized_docs]
        
        return {
            "pa_required": True,
            "missing_documents": missing,
            "document_checklist": rules["required_docs"],
        }
