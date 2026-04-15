import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID

from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import FraudDetectionException 
from models.mongo_models import AnomalyFlag
from models.postgres_models import BundledCPTRules, FraudDetectionConfig, SpecialtyBillingThresholds

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
    claim_reversal_rate: float = 0.0
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
    def __init__(self, mongo_db: AsyncIOMotorDatabase, db_session: AsyncSession, payer_id: UUID):
        self.db = mongo_db
        self.claims_collection = self.db.claims_history
        self.db_session = db_session
        self.payer_id = payer_id

    async def analyze(
        self, pa_id: UUID, patient_member_id: str, provider_npi: str, cpt_codes: List[str], billed_amount: float, provider_specialty: str = "General"
    ) -> AgentCOutput:
        """Main entry point to run all fraud and anomaly checks."""
        logger.info(f"[{pa_id}] Starting fraud and anomaly analysis for provider {provider_npi}.")

        try:
            # Run checks in parallel
            claim_check_result = await self._check_claim_history(patient_member_id, cpt_codes)
            provider_risk_result = await self._score_provider_risk(provider_npi)
            billing_anomalies = await self._detect_billing_anomalies(provider_npi, cpt_codes, billed_amount, provider_specialty)

            all_anomalies = claim_check_result.anomalies_found + billing_anomalies
            
            fraud_score = await self._calculate_fraud_score(claim_check_result, provider_risk_result, all_anomalies)
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
        """Checks for duplicate, high-frequency, and frequency spike claims for a patient."""
        anomalies = []
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        sixty_days_ago = datetime.utcnow() - timedelta(days=60)
        
        # Get 30-day claim counts
        pipeline_30 = [
            {"$match": {"patient_member_id": patient_member_id, "claims.claim_date": {"$gte": thirty_days_ago}}},
            {"$unwind": "$claims"},
            {"$match": {"claims.claim_date": {"$gte": thirty_days_ago}}},
            {"$group": {
                "_id": "$claims.cpt_code",
                "count": {"$sum": 1}
            }}
        ]
        
        cpt_counts_30 = {}
        async for doc in self.claims_collection.aggregate(pipeline_30):
            cpt_counts_30[doc['_id']] = doc['count']

        # Get 60-day claim counts for comparison (frequency spike detection)
        pipeline_60 = [
            {"$match": {"patient_member_id": patient_member_id, "claims.claim_date": {"$gte": sixty_days_ago, "$lt": thirty_days_ago}}},
            {"$unwind": "$claims"},
            {"$match": {"claims.claim_date": {"$gte": sixty_days_ago, "$lt": thirty_days_ago}}},
            {"$group": {
                "_id": "$claims.cpt_code",
                "count": {"$sum": 1}
            }}
        ]
        
        cpt_counts_60 = {}
        async for doc in self.claims_collection.aggregate(pipeline_60):
            cpt_counts_60[doc['_id']] = doc['count']

        # Check for duplicate claims (same CPT)
        for cpt in cpt_codes:
            if cpt_counts_30.get(cpt, 0) > 3:
                anomalies.append(AnomalyFlag(flag_type="DUPLICATE_CLAIM", severity="MEDIUM", details={"cpt": cpt, "count": cpt_counts_30[cpt]}, detected_at=datetime.utcnow()))

        # Check for high frequency (total claims)
        total_claims_30 = sum(cpt_counts_30.values())
        if total_claims_30 > 10:
            anomalies.append(AnomalyFlag(flag_type="HIGH_FREQUENCY", severity="LOW", details={"total_claims": total_claims_30}, detected_at=datetime.utcnow()))

        # Check for frequency spike (30-day vs 60-day comparison)
        total_claims_60 = sum(cpt_counts_60.values())
        if total_claims_60 > 0:
            frequency_increase_pct = ((total_claims_30 - total_claims_60) / total_claims_60) * 100
            if frequency_increase_pct > 40:  # 40% increase triggers spike
                anomalies.append(AnomalyFlag(flag_type="FREQUENCY_SPIKE", severity="MEDIUM", details={"increase_pct": frequency_increase_pct, "claims_30d": total_claims_30, "claims_60d": total_claims_60}, detected_at=datetime.utcnow()))

        return CheckResult("claim_history", passed=not anomalies, anomalies_found=anomalies)

    async def _score_provider_risk(self, provider_npi: str) -> ProviderRiskResult:
        """Calculates a provider's risk based on historical denial and reversal rates."""
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
                },
                "reversed_claims": {
                    "$sum": {"$cond": [{"$eq": ["$claims.status", "REVERSED"]}, 1, 0]}
                }
            }}
        ]
        
        result = await self.claims_collection.aggregate(pipeline).to_list(1)
        if not result:
            return ProviderRiskResult(npi=provider_npi, risk_level="LOW", denial_rate=0.0, total_claims=0, claim_reversal_rate=0.0)

        stats = result[0]
        total_claims = stats['total_claims']
        denied_claims = stats['denied_claims']
        reversed_claims = stats['reversed_claims']
        
        denial_rate = (denied_claims / total_claims) if total_claims > 0 else 0.0
        claim_reversal_rate = (reversed_claims / total_claims) if total_claims > 0 else 0.0
        
        # Determine risk level based on denial rate and reversal rate
        risk_level = "LOW"
        if denial_rate > 0.30 or claim_reversal_rate > 0.12:
            risk_level = "HIGH"
        elif denial_rate > 0.15 or claim_reversal_rate > 0.08:
            risk_level = "MEDIUM"
            
        return ProviderRiskResult(
            npi=provider_npi, 
            risk_level=risk_level, 
            denial_rate=denial_rate, 
            total_claims=total_claims,
            claim_reversal_rate=claim_reversal_rate
        )

    async def _detect_billing_anomalies(self, provider_npi: str, cpt_codes: List[str], billed_amount: float, provider_specialty: str = "General") -> List[AnomalyFlag]:
        """Detects various billing anomalies like upcoding, unbundling, and impossible billing."""
        anomalies = []

        # 1. Check for bundled CPT violations
        bundled_violations = await self._check_bundled_cpts(cpt_codes)
        anomalies.extend(bundled_violations)

        # 2. Upcoding detection
        upcoding_flag = await self._detect_upcoding(provider_npi, cpt_codes, billed_amount)
        if upcoding_flag:
            anomalies.append(upcoding_flag)

        # 3. Impossible Day Billing (using specialty-specific thresholds)
        impossible_billing_flag = await self._detect_impossible_billing(provider_npi, provider_specialty)
        if impossible_billing_flag:
            anomalies.append(impossible_billing_flag)

        return anomalies

    async def _check_bundled_cpts(self, cpt_codes: List[str]) -> List[AnomalyFlag]:
        """Checks if submitted CPT codes violate bundling rules."""
        anomalies = []
        
        # Fetch applicable bundling rules for this payer
        stmt = select(BundledCPTRules).where(
            BundledCPTRules.is_active == True,
            (BundledCPTRules.payer_id == self.payer_id) | (BundledCPTRules.payer_id == None)
        )
        rules = await self.db_session.execute(stmt)
        bundled_rules = rules.scalars().all()

        # Check if any pair of submitted CPTs violates a bundling rule
        for rule in bundled_rules:
            if rule.primary_cpt in cpt_codes and rule.secondary_cpt in cpt_codes:
                anomalies.append(
                    AnomalyFlag(
                        flag_type="POTENTIAL_UNBUNDLING",
                        severity="HIGH",
                        details={
                            "bundled_cpts": [rule.primary_cpt, rule.secondary_cpt],
                            "rule": rule.rule_description
                        },
                        detected_at=datetime.utcnow()
                    )
                )
                logger.warning(f"Unbundling detected: {rule.primary_cpt} + {rule.secondary_cpt} - {rule.rule_description}")

        return anomalies

    async def _detect_upcoding(self, provider_npi: str, cpt_codes: List[str], billed_amount: float) -> Optional[AnomalyFlag]:
        """Detects upcoding by comparing billed amount against provider's average."""
        if not cpt_codes:
            return None

        main_cpt = cpt_codes[0]
        avg_pipeline = [
            {"$match": {"provider_npi": provider_npi}},
            {"$unwind": "$claims"},
            {"$match": {"claims.cpt_code": main_cpt}},
            {"$group": {"_id": "$claims.cpt_code", "avg_billed": {"$avg": "$claims.billed_amount"}}}
        ]
        avg_result = await self.claims_collection.aggregate(avg_pipeline).to_list(1)
        
        if avg_result and avg_result[0]['avg_billed'] > 0:
            avg_billed = float(avg_result[0]['avg_billed'])
            if billed_amount > 3 * avg_billed:
                return AnomalyFlag(
                    flag_type="UPCODING_DETECTED",
                    severity="HIGH",
                    details={"cpt": main_cpt, "billed": billed_amount, "average": avg_billed},
                    detected_at=datetime.utcnow()
                )
        return None

    async def _detect_impossible_billing(self, provider_npi: str, provider_specialty: str) -> Optional[AnomalyFlag]:
        """Detects impossible day billing using specialty-specific thresholds."""
        # Fetch specialty threshold
        stmt = select(SpecialtyBillingThresholds).where(
            SpecialtyBillingThresholds.specialty == provider_specialty,
            SpecialtyBillingThresholds.is_active == True,
            (SpecialtyBillingThresholds.payer_id == self.payer_id) | (SpecialtyBillingThresholds.payer_id == None)
        )
        threshold_result = await self.db_session.execute(stmt)
        threshold = threshold_result.scalar_one_or_none()

        # Default to 24 if no specialty-specific threshold found
        max_claims_per_day = threshold.max_claims_per_day if threshold else 24

        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        day_pipeline = [
            {"$match": {"provider_npi": provider_npi, "claims.claim_date": {"$gte": today_start}}},
            {"$unwind": "$claims"},
            {"$match": {"claims.claim_date": {"$gte": today_start}}},
            {"$count": "claims_today"}
        ]
        day_result = await self.claims_collection.aggregate(day_pipeline).to_list(1)
        
        if day_result and day_result[0]['claims_today'] > max_claims_per_day:
            return AnomalyFlag(
                flag_type="IMPOSSIBLE_DAY_BILLING",
                severity="HIGH",
                details={"claims_today": day_result[0]['claims_today'], "max_allowed": max_claims_per_day, "specialty": provider_specialty},
                detected_at=datetime.utcnow()
            )
        return None

    async def _calculate_fraud_score(self, claim_check: CheckResult, provider_risk: ProviderRiskResult, anomaly_flags: List[AnomalyFlag]) -> float:
        """Calculates an inverted fraud score (100 is clean) using payer-specific configurations."""
        score = 100.0

        # Fetch payer-specific fraud detection configurations
        fraud_configs = {}
        stmt = select(FraudDetectionConfig).where(
            FraudDetectionConfig.payer_id == self.payer_id,
            FraudDetectionConfig.is_active == True
        )
        configs = await self.db_session.execute(stmt)
        for config in configs.scalars().all():
            fraud_configs[config.anomaly_type] = config

        # Apply deductions for each anomaly
        for anomaly in anomaly_flags:
            config = fraud_configs.get(anomaly.flag_type)
            if config:
                # Get severity multiplier from config
                multiplier = config.severity_multiplier.get(anomaly.severity, 1.0)
                deduction = float(config.base_deduction) * multiplier
                score += deduction
                logger.debug(f"Applying {anomaly.flag_type} deduction: {deduction} (base: {config.base_deduction}, multiplier: {multiplier})")
            else:
                # Fallback to hardcoded defaults if no config found
                default_deductions = {
                    "DUPLICATE_CLAIM": -25,
                    "HIGH_FREQUENCY": -15,
                    "UPCODING_DETECTED": -25,
                    "POTENTIAL_UNBUNDLING": -20,
                    "IMPOSSIBLE_DAY_BILLING": -30,
                    "FREQUENCY_SPIKE": -20,
                }
                deduction = default_deductions.get(anomaly.flag_type, 0)
                score += deduction
                logger.warning(f"Using fallback deduction for {anomaly.flag_type}: {deduction}")

        # Apply provider risk adjustments
        if provider_risk.risk_level == "HIGH":
            config = fraud_configs.get("PROVIDER_RISK_ADJUSTMENT")
            if config:
                multiplier = config.severity_multiplier.get("HIGH", 1.0)
                deduction = float(config.base_deduction) * multiplier
                score -= deduction
                logger.debug(f"Provider risk HIGH deduction: {deduction}")
            else:
                score -= 30
        elif provider_risk.risk_level == "MEDIUM":
            config = fraud_configs.get("PROVIDER_RISK_ADJUSTMENT")
            if config:
                multiplier = config.severity_multiplier.get("MEDIUM", 0.5)
                deduction = float(config.base_deduction) * multiplier
                score -= deduction
                logger.debug(f"Provider risk MEDIUM deduction: {deduction}")
            else:
                score -= 15

        # Apply claim reversal rate penalty if elevated
        if provider_risk.claim_reversal_rate > 0.12:
            config = fraud_configs.get("CLAIM_REVERSAL_RATE")
            if config:
                multiplier = config.severity_multiplier.get("HIGH", 1.0)
                deduction = float(config.base_deduction) * multiplier
                score -= deduction
                logger.debug(f"Claim reversal rate deduction: {deduction}")
            else:
                score -= 20

        return max(0.0, score)

    def _assign_risk_flag(self, fraud_score: float) -> str:
        """Assigns a categorical risk flag based on the final score."""
        if fraud_score >= 70:
            return "LOW"
        elif fraud_score >= 40:
            return "MEDIUM"
        else:
            return "HIGH"
