import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.exceptions import PolicyRuleNotFoundException, ComplianceCheckException
from ..models.postgres_models import PlanMaster, PARequest, ICDCPTCrosswalk, StatusEnum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Dataclasses for Agent B ---

@dataclass
class PayerRules:
    """Represents the fetched rules for a specific plan."""
    payer_id: UUID
    plan_id: UUID
    rule_version_id: UUID # Using plan_id as a placeholder for version
    step_therapy_required: bool
    max_quantity: Optional[int]
    pa_required: bool
    active: bool = True

@dataclass
class CheckResult:
    """Stores the result of a single compliance check."""
    check_name: str
    passed: bool
    reason: Optional[str] = None
    score_impact: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AgentBOutput:
    """The final output structure for the Policy Compliance Agent."""
    pa_id: UUID
    policy_score: float
    compliance_flags: List[str] = field(default_factory=list)
    matched_rule_id: Optional[UUID] = None
    step_therapy_status: str = "NOT_APPLICABLE"
    check_results: List[CheckResult] = field(default_factory=list)
    evaluated_at: datetime = field(default_factory=datetime.utcnow)


class PolicyComplianceAgent:
    """
    Agent B: Evaluates a PA request against payer coverage policies.
    """
    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def evaluate(
        self, pa_id: UUID, fhir_bundle: Dict[str, Any], patient_member_id: str, payer_id: UUID, plan_id: UUID
    ) -> AgentBOutput:
        """Main entry point to run all compliance checks."""
        logger.info(f"[{pa_id}] Starting policy compliance evaluation.")
        
        try:
            rules = await self._fetch_payer_rules(payer_id, plan_id)
        except PolicyRuleNotFoundException as e:
            logger.error(f"[{pa_id}] Critical error: {e}")
            # This would likely result in an immediate denial or human review
            return AgentBOutput(pa_id=pa_id, policy_score=0.0, compliance_flags=["NO_ACTIVE_POLICY_RULE"])

        # Extract data from FHIR bundle
        icd10_codes = [
            entry['resource']['code']['coding'][0]['code']
            for entry in fhir_bundle.get('entry', [])
            if entry['resource']['resourceType'] == 'Condition'
        ]
        cpt_codes = [
            entry['resource']['code']['coding'][0]['code']
            for entry in fhir_bundle.get('entry', [])
            if entry['resource']['resourceType'] == 'Procedure'
        ]
        # Placeholder for requested quantity and prior history
        requested_qty = 1 
        prior_history = "Patient has a history of hypertension."

        all_checks: List[CheckResult] = []

        # Run all checks
        all_checks.append(await self._check_diagnosis_treatment_match(icd10_codes, cpt_codes, rules))
        all_checks.append(await self._check_step_therapy(pa_id, prior_history, rules))
        all_checks.append(await self._check_quantity_limits(requested_qty, rules))
        all_checks.append(await self._check_prior_history(pa_id, patient_member_id, cpt_codes))

        policy_score = self._calculate_policy_score(all_checks)
        failed_flags = [res.reason for res in all_checks if not res.passed and res.reason]
        
        step_therapy_check = next((res for res in all_checks if res.check_name == "step_therapy"), None)
        step_therapy_status = step_therapy_check.reason if step_therapy_check else "ERROR"

        logger.info(f"[{pa_id}] Policy evaluation completed. Score: {policy_score}, Flags: {failed_flags}")

        return AgentBOutput(
            pa_id=pa_id,
            policy_score=policy_score,
            compliance_flags=failed_flags,
            matched_rule_id=rules.rule_version_id,
            step_therapy_status=step_therapy_status,
            check_results=all_checks,
        )

    async def _fetch_payer_rules(self, payer_id: UUID, plan_id: UUID) -> PayerRules:
        """Fetches active rules for a given payer and plan from the database."""
        stmt = select(PlanMaster).where(PlanMaster.plan_id == plan_id, PlanMaster.payer_id == payer_id)
        result = await self.db.execute(stmt)
        plan = result.scalar_one_or_none()

        if not plan:
            raise PolicyRuleNotFoundException(f"No plan found for plan_id {plan_id} and payer_id {payer_id}")
        
        # Assuming the plan record itself contains the rules for simplicity
        return PayerRules(
            payer_id=plan.payer_id,
            plan_id=plan.plan_id,
            rule_version_id=plan.plan_id, # Placeholder
            step_therapy_required=plan.step_therapy_required,
            max_quantity=plan.max_quantity,
            pa_required=plan.pa_required,
        )

    async def _check_diagnosis_treatment_match(self, icd10_codes: List[str], cpt_codes: List[str], rules: PayerRules) -> CheckResult:
        """Verifies that the diagnosis and treatment codes are a covered combination."""
        check_name = "diagnosis_treatment_match"
        try:
            for cpt in cpt_codes:
                stmt = select(ICDCPTCrosswalk.is_covered).where(
                    ICDCPTCrosswalk.cpt_code == cpt,
                    ICDCPTCrosswalk.icd10_code.in_(icd10_codes),
                    ICDCPTCrosswalk.is_covered == True
                )
                result = await self.db.execute(stmt)
                if not result.scalar_one_or_none():
                    return CheckResult(check_name, False, "DIAGNOSIS_TREATMENT_MISMATCH", -40.0, {"cpt": cpt, "icd10": icd10_codes})
            return CheckResult(check_name, True)
        except Exception as e:
            raise ComplianceCheckException(f"Error in {check_name}: {e}")

    async def _check_step_therapy(self, pa_id: UUID, prior_history: str, rules: PayerRules) -> CheckResult:
        """Checks if step therapy requirements have been met."""
        check_name = "step_therapy"
        if not rules.step_therapy_required:
            return CheckResult(check_name, True, "NOT_APPLICABLE")

        keywords = ["failed", "inadequate response", "contraindicated", "adverse reaction", "ineffective"]
        if any(keyword in prior_history.lower() for keyword in keywords):
            return CheckResult(check_name, True, "PASSED")
        else:
            return CheckResult(check_name, False, "STEP_THERAPY_NOT_MET", -30.0)

    async def _check_quantity_limits(self, requested_qty: int, rules: PayerRules) -> CheckResult:
        """Checks if the requested quantity exceeds plan limits."""
        check_name = "quantity_limits"
        if rules.max_quantity is None:
            return CheckResult(check_name, True, "NOT_APPLICABLE")
        
        if requested_qty > rules.max_quantity:
            return CheckResult(check_name, False, "QTY_LIMIT_EXCEEDED", -20.0, {"requested": requested_qty, "limit": rules.max_quantity})
        else:
            return CheckResult(check_name, True, "PASSED")

    async def _check_prior_history(self, pa_id: UUID, patient_member_id: str, cpt_codes: List[str]) -> CheckResult:
        """Checks for duplicate approved PAs within the validity period."""
        check_name = "prior_history"
        try:
            ninety_days_ago = datetime.utcnow() - timedelta(days=90)
            stmt = select(PARequest).where(
                PARequest.pa_id != pa_id,
                PARequest.patient_member_id == patient_member_id,
                PARequest.cpt_codes.op('&&')(cpt_codes), # Check for array overlap
                PARequest.status == StatusEnum.APPROVED,
                PARequest.decided_at >= ninety_days_ago
            )
            result = await self.db.execute(stmt)
            duplicate = result.scalar_one_or_none()

            if duplicate:
                return CheckResult(check_name, False, "DUPLICATE_PA_DETECTED", -50.0, {"duplicate_pa_id": duplicate.pa_id})
            else:
                return CheckResult(check_name, True, "PASSED")
        except Exception as e:
            raise ComplianceCheckException(f"Error in {check_name}: {e}")

    def _calculate_policy_score(self, check_results: List[CheckResult]) -> float:
        """Calculates the final policy score based on check results."""
        score = 100.0
        for result in check_results:
            if not result.passed:
                score += result.score_impact
        return max(0.0, score)
