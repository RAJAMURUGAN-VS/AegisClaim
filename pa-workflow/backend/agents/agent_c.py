import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import FraudDetectionException
from models.mongo_models import AnomalyFlag

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------- DATA CLASSES ---------------- #

@dataclass
class ProviderRiskResult:
    provider_id: str
    risk_level: str
    denial_rate: float
    total_claims: int
    claim_reversal_rate: float = 0.0
    evaluated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class CheckResult:
    check_name: str
    passed: bool
    anomalies_found: List[AnomalyFlag] = field(default_factory=list)


@dataclass
class AgentCOutput:
    pa_id: UUID
    fraud_score: float
    risk_flag: str
    anomaly_flags: List[AnomalyFlag]
    provider_risk: Optional[ProviderRiskResult]
    claim_check_result: Optional[CheckResult]
    evaluated_at: datetime = field(default_factory=datetime.utcnow)


# ---------------- MAIN AGENT ---------------- #

class FraudAnomalyAgent:

    def __init__(self, mongo_db: AsyncIOMotorDatabase, db_session: AsyncSession, payer_id: UUID):
        self.db = mongo_db
        self.claims_collection = self.db.claims_history
        self.db_session = db_session
        self.payer_id = payer_id

    async def analyze(self, pa_id: UUID, patient_member_id: str, provider_id: str,
                      cpt_codes: List[str], billed_amount: float,
                      provider_specialty: str = "General") -> AgentCOutput:

        logger.info(f"[{pa_id}] Starting fraud analysis...")

        try:
            claim_check = await self._check_claim_history(patient_member_id, cpt_codes)
            provider_risk = await self._score_provider_risk(provider_id)
            billing_flags = await self._detect_billing_anomalies(provider_id, cpt_codes, billed_amount)

            all_flags = claim_check.anomalies_found + billing_flags

            fraud_score = self._calculate_fraud_score(all_flags)
            risk_flag = self._assign_risk_flag(fraud_score)

            return AgentCOutput(
                pa_id=pa_id,
                fraud_score=fraud_score,
                risk_flag=risk_flag,
                anomaly_flags=all_flags,
                provider_risk=provider_risk,
                claim_check_result=claim_check
            )

        except Exception as e:
            raise FraudDetectionException(str(e))

    # ---------------- CLAIM HISTORY ---------------- #

    async def _check_claim_history(self, patient_member_id: str, cpt_codes: List[str]) -> CheckResult:

        anomalies = []
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)

        pipeline = [
            {
                "$match": {
                    "patient_member_id": patient_member_id,
                    "claim_date": {"$gte": thirty_days_ago}
                }
            },
            {"$unwind": "$cpt_codes"},
            {
                "$group": {
                    "_id": "$cpt_codes",
                    "count": {"$sum": 1}
                }
            }
        ]

        cpt_counts = {}
        async for doc in self.claims_collection.aggregate(pipeline):
            cpt_counts[doc["_id"]] = doc["count"]

        for cpt in cpt_codes:
            if cpt_counts.get(cpt, 0) > 2:
                anomalies.append(AnomalyFlag(
                    flag_type="DUPLICATE_CLAIM",
                    severity="MEDIUM",
                    details={"cpt": cpt},
                    detected_at=datetime.utcnow()
                ))

        return CheckResult("claim_history", passed=not anomalies, anomalies_found=anomalies)

    # ---------------- PROVIDER RISK ---------------- #

    async def _score_provider_risk(self, provider_id: str) -> ProviderRiskResult:

        pipeline = [
            {"$match": {"provider_id": provider_id}},
            {
                "$group": {
                    "_id": "$provider_id",
                    "total_claims": {"$sum": 1},
                    "denied_claims": {
                        "$sum": {"$cond": [{"$eq": ["$status", "DENIED"]}, 1, 0]}
                    }
                }
            }
        ]

        result = await self.claims_collection.aggregate(pipeline).to_list(1)

        if not result:
            return ProviderRiskResult(provider_id, "LOW", 0.0, 0)

        stats = result[0]
        total = stats["total_claims"]
        denied = stats["denied_claims"]

        denial_rate = denied / total if total else 0

        risk = "LOW"
        if denial_rate > 0.3:
            risk = "HIGH"
        elif denial_rate > 0.15:
            risk = "MEDIUM"

        return ProviderRiskResult(provider_id, risk, denial_rate, total)

    # ---------------- BILLING ANOMALIES (IQR BASED) ---------------- #

    async def _detect_billing_anomalies(self, provider_id, cpt_codes, billed_amount):

        anomalies = []

        if not cpt_codes:
            return anomalies

        main_cpt = cpt_codes[0]

        pipeline = [
            {"$unwind": "$cpt_codes"},
            {"$match": {"cpt_codes": main_cpt}},
            {"$group": {"_id": "$cpt_codes", "amounts": {"$push": "$billed_amount"}}}
        ]

        result = await self.claims_collection.aggregate(pipeline).to_list(1)

        if not result or len(result[0]["amounts"]) < 5:
            return anomalies

        amounts = sorted(result[0]["amounts"])
        n = len(amounts)

        q1 = amounts[n // 4]
        q3 = amounts[(3 * n) // 4]
        iqr = q3 - q1

        upper_bound = q3 + (1.5 * iqr)

        if billed_amount > upper_bound:
            anomalies.append(
                AnomalyFlag(
                    flag_type="UPCODING_DETECTED",
                    severity="HIGH",
                    details={
                        "cpt": main_cpt,
                        "billed": billed_amount,
                        "upper_bound": round(upper_bound, 2),
                        "q1": q1,
                        "q3": q3,
                        "iqr": iqr,
                        "ratio_vs_q3": round(billed_amount / q3, 2),
                        "message": "Billed amount exceeds statistical upper bound"
                    },
                    detected_at=datetime.utcnow()
                )
            )

        return anomalies

    # ---------------- SCORING ---------------- #

    def _calculate_fraud_score(self, anomalies):

        score = 100

        deductions = {
            "DUPLICATE_CLAIM": 20,
            "UPCODING_DETECTED": 30
        }

        for a in anomalies:
            score -= deductions.get(a.flag_type, 10)

        return max(score, 0)

    def _assign_risk_flag(self, score):

        if score >= 70:
            return "LOW"
        elif score >= 40:
            return "MEDIUM"
        else:
            return "HIGH"