import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorDatabase

from core.exceptions import FraudDetectionException
from models.mongo_models import AnomalyFlag

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Dataclasses for Agent C ---

@dataclass
class ProviderRiskResult:
    """Stores the result of a provider risk assessment."""
    npi: str
    risk_level: str  # LOW, MEDIUM, HIGH
    denial_rate: float
    total_claims: int
    evaluated_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class CheckResult:
    """Stores the result of a single fraud check."""
    check_name: str
    passed: bool
    anomalies_found: List[AnomalyFlag] = field(default_factory=list)

@dataclass
class AgentCOutput:
    """The final output structure for the Fraud & Anomaly Agent."""
    pa_id: UUID
    fraud_score: float  # Inverted score: 100 = clean, 0 = high risk
    risk_flag: str  # LOW, MEDIUM, HIGH
    anomaly_flags: List[AnomalyFlag] = field(default_factory=list)
    provider_risk: Optional[ProviderRiskResult] = None
    claim_check_result: Optional[CheckResult] = None
    evaluated_at: datetime = field(default_factory=datetime.utcnow)


class FraudAnomalyAgent:
    """
    Agent C: Analyzes claim history to detect fraud, abuse, and anomalies.
    """
    def __init__(self, mongo_db: AsyncIOMotorDatabase):
        self.db = mongo_db
        self.claims_collection = self.db.claims_history

    async def analyze(
        self, pa_id: UUID, patient_member_id: str, provider_npi: str, cpt_codes: List[str], billed_amount: float
    ) -> AgentCOutput:
        """Main entry point to run all fraud and anomaly checks."""
        logger.info(f"[{pa_id}] Starting fraud and anomaly analysis for provider {provider_npi}.")

        try:
            # Run checks in parallel
            claim_check_result = await self._check_claim_history(patient_member_id, cpt_codes)
            provider_risk_result = await self._score_provider_risk(provider_npi)
            billing_anomalies = await self._detect_billing_anomalies(provider_npi, cpt_codes, billed_amount)

            all_anomalies = claim_check_result.anomalies_found + billing_anomalies
            
            fraud_score = self._calculate_fraud_score(claim_check_result, provider_risk_result, all_anomalies)
            risk_flag = self._assign_risk_flag(fraud_score)

            logger.info(f"[{pa_id}] Fraud analysis completed. Score: {fraud_score}, Risk: {risk_flag}")

            return AgentCOutput(
                pa_id=pa_id,
                fraud_score=fraud_score,
                risk_flag=risk_flag,
                anomaly_flags=all_anomalies,
                provider_risk=provider_risk_result,
                claim_check_result=claim_check_result,
            )
        except Exception as e:
            logger.error(f"[{pa_id}] An error occurred during fraud analysis: {e}")
            raise FraudDetectionException(f"Failed to analyze fraud for PA {pa_id}: {e}")

    async def _check_claim_history(self, patient_member_id: str, cpt_codes: List[str]) -> CheckResult:
        """Checks for duplicate and high-frequency claims for a patient."""
        anomalies = []
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        pipeline = [
            {"$match": {"patient_member_id": patient_member_id, "claims.claim_date": {"$gte": thirty_days_ago}}},
            {"$unwind": "$claims"},
            {"$match": {"claims.claim_date": {"$gte": thirty_days_ago}}},
            {"$group": {
                "_id": "$claims.cpt_code",
                "count": {"$sum": 1}
            }}
        ]
        
        cpt_counts = {}
        async for doc in self.claims_collection.aggregate(pipeline):
            cpt_counts[doc['_id']] = doc['count']

        # Check for duplicate claims (same CPT)
        for cpt in cpt_codes:
            if cpt_counts.get(cpt, 0) > 3:
                anomalies.append(AnomalyFlag(flag_type="DUPLICATE_CLAIM", severity="MEDIUM", details={"cpt": cpt, "count": cpt_counts[cpt]}, detected_at=datetime.utcnow()))

        # Check for high frequency (total claims)
        total_claims_last_30_days = sum(cpt_counts.values())
        if total_claims_last_30_days > 10:
            anomalies.append(AnomalyFlag(flag_type="HIGH_FREQUENCY", severity="LOW", details={"total_claims": total_claims_last_30_days}, detected_at=datetime.utcnow()))

        return CheckResult("claim_history", passed=not anomalies, anomalies_found=anomalies)

    async def _score_provider_risk(self, provider_npi: str) -> ProviderRiskResult:
        """Calculates a provider's risk based on historical denial rate."""
        twelve_months_ago = datetime.utcnow() - timedelta(days=365)
        pipeline = [
            {"$match": {"provider_npi": provider_npi, "claims.claim_date": {"$gte": twelve_months_ago}}},
            {"$unwind": "$claims"},
            {"$match": {"claims.claim_date": {"$gte": twelve_months_ago}}},
            {"$group": {
                "_id": "$provider_npi",
                "total_claims": {"$sum": 1},
                "denied_claims": {
                    "$sum": {"$cond": [{"$eq": ["$claims.status", "DENIED"]}, 1, 0]}
                }
            }}
        ]
        
        result = await self.claims_collection.aggregate(pipeline).to_list(1)
        if not result:
            return ProviderRiskResult(npi=provider_npi, risk_level="LOW", denial_rate=0.0, total_claims=0)

        stats = result[0]
        total_claims = stats['total_claims']
        denial_rate = (stats['denied_claims'] / total_claims) if total_claims > 0 else 0.0
        
        risk_level = "LOW"
        if denial_rate > 0.3:
            risk_level = "HIGH"
        elif denial_rate > 0.15:
            risk_level = "MEDIUM"
            
        return ProviderRiskResult(npi=provider_npi, risk_level=risk_level, denial_rate=denial_rate, total_claims=total_claims)

    async def _detect_billing_anomalies(self, provider_npi: str, cpt_codes: List[str], billed_amount: float) -> List[AnomalyFlag]:
        """Detects various billing anomalies like upcoding and unbundling."""
        anomalies = []

        # 1. Unbundling
        if len(cpt_codes) > 5:
            anomalies.append(AnomalyFlag(flag_type="POTENTIAL_UNBUNDLING", severity="MEDIUM", details={"cpt_count": len(cpt_codes)}, detected_at=datetime.utcnow()))

        # 2. Upcoding
        if cpt_codes:
            main_cpt = cpt_codes[0]
            avg_pipeline = [
                {"$match": {"provider_npi": provider_npi}},
                {"$unwind": "$claims"},
                {"$match": {"claims.cpt_code": main_cpt}},
                {"$group": {"_id": "$claims.cpt_code", "avg_billed": {"$avg": "$claims.billed_amount"}}}
            ]
            avg_result = await self.claims_collection.aggregate(avg_pipeline).to_list(1)
            if avg_result and avg_result[0]['avg_billed'] > 0:
                avg_billed = avg_result[0]['avg_billed']
                if billed_amount > 3 * avg_billed:
                    anomalies.append(AnomalyFlag(flag_type="UPCODING_DETECTED", severity="HIGH", details={"cpt": main_cpt, "billed": billed_amount, "average": avg_billed}, detected_at=datetime.utcnow()))

        # 3. Impossible Day Billing
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        day_pipeline = [
            {"$match": {"provider_npi": provider_npi, "claims.claim_date": {"$gte": today_start}}},
            {"$unwind": "$claims"},
            {"$match": {"claims.claim_date": {"$gte": today_start}}},
            {"$count": "claims_today"}
        ]
        day_result = await self.claims_collection.aggregate(day_pipeline).to_list(1)
        if day_result and day_result[0]['claims_today'] > 24:
            anomalies.append(AnomalyFlag(flag_type="IMPOSSIBLE_DAY_BILLING", severity="HIGH", details={"claims_today": day_result[0]['claims_today']}, detected_at=datetime.utcnow()))

        return anomalies

    def _calculate_fraud_score(self, claim_check: CheckResult, provider_risk: ProviderRiskResult, anomaly_flags: List[AnomalyFlag]) -> float:
        """Calculates an inverted fraud score (100 is clean)."""
        score = 100.0
        deductions = {
            "DUPLICATE_CLAIM": -25,
            "HIGH_FREQUENCY": -15,
            "UPCODING_DETECTED": -25,
            "POTENTIAL_UNBUNDLING": -20,
            "IMPOSSIBLE_DAY_BILLING": -30,
        }
        
        for anomaly in anomaly_flags:
            score += deductions.get(anomaly.flag_type, 0)
            
        if provider_risk.risk_level == "HIGH":
            score -= 30
        elif provider_risk.risk_level == "MEDIUM":
            score -= 15
            
        return max(0.0, score)

    def _assign_risk_flag(self, fraud_score: float) -> str:
        """Assigns a categorical risk flag based on the final score."""
        if fraud_score >= 70:
            return "LOW"
        elif fraud_score >= 40:
            return "MEDIUM"
        else:
            return "HIGH"
