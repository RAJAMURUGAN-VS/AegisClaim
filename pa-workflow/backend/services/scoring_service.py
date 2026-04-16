import logging
import random
from datetime import date, datetime, timedelta
from typing import List, Optional, Literal
from dataclasses import dataclass, field
from uuid import UUID

from ..core.exceptions import AuthCodeGenerationException, ScoringException

logger = logging.getLogger(__name__)

# --- Dataclasses for Service I/O ---

@dataclass
class DecisionResult:
    """Represents the outcome of a decision rule evaluation."""
    decision: Literal["AUTO_APPROVE", "HUMAN_REVIEW", "AUTO_DENY"]
    reason: str
    confidence: float
    override_applied: bool = False

@dataclass
class DenialReason:
    """Structured reason for a denial decision."""
    plain_language_reason: str
    policy_clause: str
    missing_documents: List[str]
    appeals_instructions: str
    compliance_flags: List[str]

@dataclass
class ScoringResult:
    """The final, comprehensive output of the scoring service."""
    pa_id: UUID
    policy_score: float
    clinical_match_score: float
    fraud_score: float
    final_score: float
    decision_result: DecisionResult
    denial_reason: Optional[DenialReason] = None
    auth_code: Optional[str] = None
    valid_until: Optional[date] = None
    scored_at: datetime = field(default_factory=datetime.utcnow)


class ScoringService:
    """
    A purely functional service to calculate scores, make decisions,
    and generate relevant artifacts for a Prior Authorization request.
    """

    def calculate_final_score(
        self,
        policy_score: float,
        clinical_match_score: float,
        fraud_score: float
    ) -> float:
        """
        Applies a weighted formula to calculate the final score.
        """
        logger.info("Calculating final weighted score.")
        
        final_score = (
            (policy_score * 0.40) +
            (clinical_match_score * 0.35) +
            (fraud_score * 0.25)
        )
        
        # Round to 2 decimal places and clamp between 0 and 100
        final_score = round(final_score, 2)
        final_score = max(0.0, min(100.0, final_score))
        
        logger.info(f"Final score calculated: {final_score}")
        return final_score

    def make_decision(
        self,
        final_score: float,
        risk_flag: str,
        compliance_flags: List[str]
    ) -> DecisionResult:
        """
        Applies a set of ordered rules to determine the routing decision.
        """
        logger.info(f"Making decision with score={final_score}, risk='{risk_flag}', flags={compliance_flags}")

        # RULE 1 — High Risk Override
        if risk_flag == "HIGH":
            logger.warning("High risk flag detected. Overriding to HUMAN_REVIEW.")
            return DecisionResult(
                decision="HUMAN_REVIEW",
                reason="HIGH_RISK_FLAG_OVERRIDE",
                confidence=final_score,
                override_applied=True
            )

        # RULE 2 — Critical Compliance Flag
        critical_flags = ["DUPLICATE_PA_DETECTED", "DIAGNOSIS_TREATMENT_MISMATCH"]
        for flag in critical_flags:
            if flag in compliance_flags:
                if final_score < 60:
                    logger.warning(f"Critical flag '{flag}' with low score. Auto-denying.")
                    return DecisionResult("AUTO_DENY", reason=flag, confidence=final_score)
                else:
                    logger.warning(f"Critical flag '{flag}' with sufficient score. Routing to human review.")
                    return DecisionResult("HUMAN_REVIEW", reason=flag, confidence=final_score)

        # RULE 4 (checked before RULE 3 for precedence) — Tie-breaking
        if final_score == 60.0:
            logger.info("Score is exactly 60.0. Tie-breaking to HUMAN_REVIEW.")
            return DecisionResult("HUMAN_REVIEW", reason="SCORE_IN_REVIEW_RANGE", confidence=final_score)

        # RULE 3 — Score-based routing
        if final_score >= 85 and risk_flag == "LOW":
            logger.info("High score and low risk. Auto-approving.")
            return DecisionResult("AUTO_APPROVE", reason="HIGH_CONFIDENCE_SCORE", confidence=final_score)
        elif final_score >= 60:
            logger.info("Score in review range. Routing to HUMAN_REVIEW.")
            return DecisionResult("HUMAN_REVIEW", reason="SCORE_IN_REVIEW_RANGE", confidence=final_score)
        else: # final_score < 60
            logger.info("Low confidence score. Auto-denying.")
            return DecisionResult("AUTO_DENY", reason="LOW_CONFIDENCE_SCORE", confidence=final_score)

    def generate_auth_code(self, pa_id: str, _attempts: int = 5) -> str:
        """
        Generates a unique authorization code for an approved PA.
        
        Note: The uniqueness check here is simulated. In a real system, this
        would involve a database check.
        """
        logger.info(f"Generating authorization code for PA ID: {pa_id}")
        year = datetime.now().year
        for i in range(_attempts):
            random_digits = str(random.randint(100000, 999999))
            auth_code = f"PA-{year}-{random_digits}"
            # In a real system, you would query your DB here to ensure uniqueness.
            # e.g., if not db.auth_codes.find_one({"code": auth_code}):
            logger.info(f"Generated auth code '{auth_code}' on attempt {i+1}.")
            return auth_code
        
        logger.error(f"Failed to generate a unique auth code for PA ID {pa_id} after {_attempts} attempts.")
        raise AuthCodeGenerationException("Failed to generate a unique authorization code.")

    def calculate_validity_period(
        self,
        decision: str,
        treatment_type: Optional[str] = None
    ) -> Optional[date]:
        """
        Calculates the expiry date for an approved authorization.
        """
        if decision != "AUTO_APPROVE":
            return None

        today = date.today()
        days = 90  # Default validity

        if treatment_type:
            if treatment_type.upper() == "PHARMACY":
                days = 30
            elif treatment_type.upper() == "INPATIENT":
                days = 60
            elif treatment_type.upper() == "MENTAL_HEALTH":
                days = 45
        
        expiry_date = today + timedelta(days=days)
        logger.info(f"Calculated validity period: {days} days. Expires on {expiry_date}.")
        return expiry_date

    def generate_denial_reason(
        self,
        compliance_flags: List[str],
        final_score: float
    ) -> DenialReason:
        """
        Generates a structured, plain-language reason for a denial.
        """
        reason_map = {
            "STEP_THERAPY_NOT_MET": "Prior treatment step therapy requirements have not been met. Documentation of failed first-line treatment is required.",
            "QTY_LIMIT_EXCEEDED": "The requested quantity exceeds the maximum allowed under your plan.",
            "DIAGNOSIS_TREATMENT_MISMATCH": "The requested procedure does not match the submitted diagnosis codes.",
            "DUPLICATE_PA_DETECTED": "An active authorization already exists for this treatment.",
            "LOW_CONFIDENCE_SCORE": "Insufficient clinical documentation provided to support this request."
        }
        
        # Find the first matching flag, or default to low score reason
        primary_flag = next((flag for flag in compliance_flags if flag in reason_map), "LOW_CONFIDENCE_SCORE")
        
        plain_language = reason_map.get(primary_flag, reason_map["LOW_CONFIDENCE_SCORE"])
        
        logger.info(f"Generating denial reason for flags: {compliance_flags}. Primary reason: {primary_flag}")

        return DenialReason(
            plain_language_reason=plain_language,
            policy_clause="Section 4.2.1", # Placeholder
            missing_documents=["Detailed Clinical Notes"] if primary_flag == "LOW_CONFIDENCE_SCORE" else [], # Placeholder
            appeals_instructions="Please visit our provider portal at provider.aegis.com/appeals to submit an appeal within 30 days.",
            compliance_flags=compliance_flags
        )

