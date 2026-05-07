
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Tuple, Set
from uuid import UUID
from enum import Enum

from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from core.exceptions import FraudDetectionException
from models.mongo_models import AnomalyFlag

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# ENUMS AND CONFIGURATION
# ============================================================================

class SeverityLevel(str, Enum):
    """Anomaly severity classification."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RiskLevel(str, Enum):
    """Overall fraud risk classification."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass
class MedicalNecessityRules:
    """Configurable medical necessity thresholds and mappings."""
    
    # ICD-CPT justification matrix
    icd_cpt_mappings: Dict[str, List[str]] = field(default_factory=dict)
    
    # Minimum imaging findings severity to justify intervention (1-5 scale)
    min_imaging_severity: Dict[str, int] = field(default_factory=lambda: {
        "MRI": 3,
        "CT": 3,
        "Ultrasound": 2,
        "X-ray": 2
    })
    
    # Minimum conservative care duration (days) before surgery
    min_conservative_care_days: Dict[str, int] = field(default_factory=lambda: {
        "spinal_surgery": 90,
        "joint_surgery": 60,
        "cardiac_surgery": 180,
        "orthopedic_surgery": 60
    })
    
    # Specialty alignment rules
    specialty_cpt_mappings: Dict[str, List[str]] = field(default_factory=dict)
    
    # Billing norms (min, max) per procedure type
    billing_norms: Dict[str, Tuple[float, float]] = field(default_factory=lambda: {
        "spinal_surgery": (15000, 45000),
        "joint_replacement": (20000, 50000),
        "cardiac_cath": (5000, 15000),
        "mri": (1000, 3000)
    })


@dataclass
class ScoringWeights:
    """Weighted components for fraud risk calculation."""
    ocr_confidence: float = 0.10
    extraction_confidence: float = 0.10
    clinical_necessity: float = 0.25
    fraud_anomalies: float = 0.35
    provider_risk: float = 0.20


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class AnomalyDetail:
    """Enhanced anomaly with comprehensive context."""
    flag_type: str
    severity: SeverityLevel
    confidence: float  # 0.0 to 1.0
    details: Dict
    recommendation: str
    detected_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_anomaly_flag(self) -> AnomalyFlag:
        """Convert to AnomalyFlag for MongoDB storage."""
        return AnomalyFlag(
            flag_type=self.flag_type,
            severity=self.severity.value,
            details={
                **self.details,
                "confidence": self.confidence,
                "recommendation": self.recommendation
            },
            detected_at=self.detected_at
        )


@dataclass
class ScoringComponents:
    """Multi-dimensional scoring system (all 0-100 scale)."""
    ocr_confidence: float  # OCR extraction quality
    extraction_confidence: float  # Data extraction quality
    clinical_necessity_score: float  # Medical justification
    fraud_risk_score: float  # Fraud probability
    approval_likelihood: float  # Approval chance
    
    def __post_init__(self):
        """Validate all scores in 0-100 range."""
        for attr in ['ocr_confidence', 'extraction_confidence', 'clinical_necessity_score',
                     'fraud_risk_score', 'approval_likelihood']:
            value = getattr(self, attr)
            setattr(self, attr, max(0, min(100, value)))


@dataclass
class ProviderRiskResult:
    """Provider risk assessment with multiple dimensions."""
    provider_id: str
    risk_level: RiskLevel
    denial_rate: float
    total_claims: int
    claim_reversal_rate: float = 0.0
    high_cost_claims_pct: float = 0.0
    repeated_fraud_flags_pct: float = 0.0
    evaluated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class AgentCOutput:
    """Comprehensive fraud analysis output."""
    pa_id: UUID
    scoring_components: ScoringComponents
    fraud_risk_level: RiskLevel
    approval_likelihood: float  # 0-100
    anomaly_flags: List[AnomalyFlag]
    anomaly_explanations: List[str]
    provider_risk: Optional[ProviderRiskResult]
    reasoning: str
    recommendations: List[str]
    evaluated_at: datetime = field(default_factory=datetime.utcnow)


# ============================================================================
# MAIN FRAUD DETECTION AGENT
# ============================================================================

class FraudAnomalyAgent:
    """
    Advanced healthcare fraud and anomaly detection engine.
    
    Implements 10 detection modules with configurable rules and
    multi-dimensional scoring for production healthcare fraud detection.
    """

    def __init__(
        self,
        mongo_db: AsyncIOMotorDatabase,
        db_session: AsyncSession,
        payer_id: UUID,
        medical_rules: Optional[MedicalNecessityRules] = None,
        scoring_weights: Optional[ScoringWeights] = None
    ):
        """Initialize fraud detection agent."""
        self.db = mongo_db
        self.claims_collection = self.db.claims_history
        self.db_session = db_session
        self.payer_id = payer_id
        
        self.medical_rules = medical_rules or MedicalNecessityRules()
        self.scoring_weights = scoring_weights or ScoringWeights()
        
        # Initialize defaults if not provided
        if not self.medical_rules.icd_cpt_mappings:
            self.medical_rules.icd_cpt_mappings = self._get_default_icd_cpt_mappings()
        if not self.medical_rules.specialty_cpt_mappings:
            self.medical_rules.specialty_cpt_mappings = self._get_default_specialty_mappings()

    async def analyze(
        self,
        pa_id: UUID,
        patient_member_id: str,
        provider_id: str,
        provider_specialty: str,
        cpt_codes: List[str],
        icd_codes: List[str],
        billed_amount: float,
        ocr_confidence: float = 0.9,
        extraction_confidence: float = 0.85,
        imaging_findings: Optional[Dict] = None,
        conservative_care_history: Optional[Dict] = None,
        treatment_setting: str = "outpatient",
        supporting_documents: Optional[List[str]] = None
    ) -> AgentCOutput:
        """
        Comprehensive fraud analysis combining all detection modules.
        
        Args:
            pa_id: Prior Authorization ID
            patient_member_id: Patient identifier
            provider_id: Provider identifier
            provider_specialty: Provider's medical specialty
            cpt_codes: List of CPT procedure codes
            icd_codes: List of ICD diagnosis codes
            billed_amount: Total billed amount
            ocr_confidence: OCR extraction confidence (0-1)
            extraction_confidence: Data extraction confidence (0-1)
            imaging_findings: Dict with modality, severity, findings
            conservative_care_history: Dict with PT/therapy history
            treatment_setting: "outpatient", "inpatient", "emergency"
            supporting_documents: List of document types present
            
        Returns:
            AgentCOutput with comprehensive fraud assessment
        """
        
        logger.info(f"[{pa_id}] Starting comprehensive fraud analysis...")
        
        try:
            # Run all 10 anomaly detection modules
            anomaly_details: List[AnomalyDetail] = []
            
            anomaly_details.extend(await self._detect_duplicate_claims(patient_member_id, cpt_codes))
            anomaly_details.extend(await self._detect_icd_cpt_mismatch(icd_codes, cpt_codes))
            anomaly_details.extend(await self._detect_weak_medical_necessity(
                icd_codes, imaging_findings, cpt_codes
            ))
            anomaly_details.extend(await self._detect_insufficient_conservative_care(
                cpt_codes, conservative_care_history
            ))
            anomaly_details.extend(self._detect_specialty_mismatch(provider_specialty, cpt_codes))
            anomaly_details.extend(await self._detect_excessive_billing(
                cpt_codes, billed_amount, provider_id
            ))
            anomaly_details.extend(self._detect_missing_supporting_documents(
                cpt_codes, icd_codes, supporting_documents or []
            ))
            anomaly_details.extend(self._detect_treatment_setting_mismatch(
                cpt_codes, treatment_setting
            ))
            anomaly_details.extend(await self._detect_rapid_repeat_procedures(
                patient_member_id, cpt_codes
            ))
            anomaly_details.extend(self._detect_impossible_combinations(icd_codes, cpt_codes))
            
            # Provider risk assessment
            provider_risk = await self._score_provider_risk(provider_id)
            anomaly_details.extend(await self._detect_high_risk_provider_pattern(provider_id))
            
            # Convert to anomaly flags
            anomaly_flags = [ad.to_anomaly_flag() for ad in anomaly_details]
            anomaly_explanations = [ad.recommendation for ad in anomaly_details]
            
            # Calculate comprehensive scores
            scoring = await self._calculate_comprehensive_scores(
                anomaly_details, ocr_confidence, extraction_confidence,
                cpt_codes, icd_codes, billed_amount, provider_risk
            )
            
            # Determine risk and approval
            fraud_risk_level = self._determine_fraud_risk_level(scoring)
            approval_likelihood = self._calculate_approval_likelihood(scoring)
            
            # Generate explanations
            reasoning = self._generate_reasoning(anomaly_details, scoring, fraud_risk_level)
            recommendations = self._generate_recommendations(anomaly_details, fraud_risk_level)
            
            logger.info(f"[{pa_id}] Analysis complete. Risk: {fraud_risk_level.value}, "
                       f"Approval: {approval_likelihood:.1f}%")
            
            return AgentCOutput(
                pa_id=pa_id,
                scoring_components=scoring,
                fraud_risk_level=fraud_risk_level,
                approval_likelihood=approval_likelihood,
                anomaly_flags=anomaly_flags,
                anomaly_explanations=anomaly_explanations,
                provider_risk=provider_risk,
                reasoning=reasoning,
                recommendations=recommendations
            )

        except Exception as e:
            logger.error(f"[{pa_id}] Fraud analysis failed: {str(e)}", exc_info=True)
            raise FraudDetectionException(f"Fraud detection failed: {str(e)}")

    # ========================================================================
    # MODULE 1: DUPLICATE CLAIM DETECTION
    # ========================================================================
    
    async def _detect_duplicate_claims(
        self,
        patient_member_id: str,
        cpt_codes: List[str]
    ) -> List[AnomalyDetail]:
        """Detect duplicate claims within 30 days."""
        anomalies = []
        if not cpt_codes:
            return anomalies
        
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        pipeline = [
            {
                "$match": {
                    "patient_member_id": patient_member_id,
                    "claim_date": {"$gte": thirty_days_ago}
                }
            },
            {"$unwind": "$cpt_codes"},
            {"$group": {"_id": "$cpt_codes", "count": {"$sum": 1}}}
        ]
        
        cpt_counts = {}
        async for doc in self.claims_collection.aggregate(pipeline):
            cpt_counts[doc["_id"]] = doc["count"]
        
        for cpt in cpt_codes:
            count = cpt_counts.get(cpt, 0)
            if count > 2:
                anomalies.append(AnomalyDetail(
                    flag_type="DUPLICATE_CLAIM",
                    severity=SeverityLevel.MEDIUM if count == 3 else SeverityLevel.HIGH,
                    confidence=0.95,
                    details={
                        "cpt": cpt,
                        "count_in_30_days": count,
                        "threshold_exceeded": count - 2
                    },
                    recommendation=f"CPT {cpt} submitted {count} times in 30 days. "
                                 f"Review for duplicate billing or bundling violations."
                ))
        
        return anomalies

    # ========================================================================
    # MODULE 2: ICD-CPT MISMATCH
    # ========================================================================
    
    async def _detect_icd_cpt_mismatch(
        self,
        icd_codes: List[str],
        cpt_codes: List[str]
    ) -> List[AnomalyDetail]:
        """Detect when diagnosis severity does not justify procedure."""
        anomalies = []
        if not icd_codes or not cpt_codes:
            return anomalies
        
        for cpt in cpt_codes:
            justified = False
            for icd in icd_codes:
                acceptable = self.medical_rules.icd_cpt_mappings.get(icd, [])
                if cpt in acceptable:
                    justified = True
                    break
            
            if not justified:
                anomalies.append(AnomalyDetail(
                    flag_type="ICD_CPT_MISMATCH",
                    severity=SeverityLevel.HIGH,
                    confidence=0.85,
                    details={
                        "cpt": cpt,
                        "icd_codes": icd_codes,
                        "message": "Procedure not medically justified by diagnoses"
                    },
                    recommendation=f"Procedure {cpt} appears disproportionate to documented diagnoses. "
                                 f"Request physician justification or updated clinical notes."
                ))
        
        return anomalies

    # ========================================================================
    # MODULE 3: MEDICAL NECESSITY WEAKNESS
    # ========================================================================
    
    async def _detect_weak_medical_necessity(
        self,
        icd_codes: List[str],
        imaging_findings: Optional[Dict],
        cpt_codes: List[str]
    ) -> List[AnomalyDetail]:
        """Detect weak objective evidence for intervention."""
        anomalies = []
        
        if imaging_findings:
            modality = imaging_findings.get("modality")
            severity = imaging_findings.get("severity", 0)
            findings = imaging_findings.get("findings", "")
            
            min_severity = self.medical_rules.min_imaging_severity.get(modality, 1)
            
            if severity < min_severity:
                anomalies.append(AnomalyDetail(
                    flag_type="MEDICAL_NECESSITY_WEAK",
                    severity=SeverityLevel.MEDIUM,
                    confidence=0.80,
                    details={
                        "imaging_modality": modality,
                        "finding_severity": severity,
                        "minimum_required": min_severity,
                        "findings": findings
                    },
                    recommendation=f"{modality} findings (severity {severity}) do not adequately "
                                 f"support surgical intervention. Recommend conservative care first."
                ))
        else:
            anomalies.append(AnomalyDetail(
                flag_type="MEDICAL_NECESSITY_WEAK",
                severity=SeverityLevel.LOW,
                confidence=0.70,
                details={"issue": "Missing or vague imaging findings", "icd_codes": icd_codes},
                recommendation="Request detailed imaging reports with specific measurements."
            ))
        
        return anomalies

    # ========================================================================
    # MODULE 4: INSUFFICIENT CONSERVATIVE CARE
    # ========================================================================
    
    async def _detect_insufficient_conservative_care(
        self,
        cpt_codes: List[str],
        conservative_care_history: Optional[Dict]
    ) -> List[AnomalyDetail]:
        """Detect inadequate conservative therapy before surgery."""
        anomalies = []
        
        # Check if surgical procedure
        is_surgical = any(cpt.startswith(('20', '22', '23', '24', '25', '26', '27'))
                         for cpt in cpt_codes)
        
        if not is_surgical or not conservative_care_history:
            return anomalies
        
        pt_duration = conservative_care_history.get("pt_duration_days", 0)
        medications = conservative_care_history.get("medications_tried", [])
        injections = conservative_care_history.get("injections_attempted", False)
        
        min_duration = 60
        for proc_type, min_days in self.medical_rules.min_conservative_care_days.items():
            if any(proc_type.replace('_', '') in cpt.lower() for cpt in cpt_codes):
                min_duration = min_days
                break
        
        if pt_duration < min_duration:
            anomalies.append(AnomalyDetail(
                flag_type="INSUFFICIENT_CONSERVATIVE_CARE",
                severity=SeverityLevel.MEDIUM if min_duration - pt_duration > 30 else SeverityLevel.LOW,
                confidence=0.80,
                details={
                    "pt_duration_days": pt_duration,
                    "minimum_required": min_duration,
                    "shortfall": min_duration - pt_duration
                },
                recommendation=f"PT duration ({pt_duration}d) below standard {min_duration}d. "
                             f"Extend conservative care or provide clinical justification."
            ))
        
        if not medications and not injections:
            anomalies.append(AnomalyDetail(
                flag_type="INSUFFICIENT_CONSERVATIVE_CARE",
                severity=SeverityLevel.MEDIUM,
                confidence=0.75,
                details={
                    "medications_tried": bool(medications),
                    "injections_attempted": injections
                },
                recommendation="No medical management or injections documented. "
                             "Request trial of medications/blocks before surgical approval."
            ))
        
        return anomalies

    # ========================================================================
    # MODULE 5: SPECIALTY MISMATCH
    # ========================================================================
    
    def _detect_specialty_mismatch(
        self,
        provider_specialty: str,
        cpt_codes: List[str]
    ) -> List[AnomalyDetail]:
        """Detect when provider specialty does not align with procedure."""
        anomalies = []
        
        specialty_norm = provider_specialty.lower().replace(" ", "_")
        acceptable = self.medical_rules.specialty_cpt_mappings.get(specialty_norm, [])
        
        mismatched = [cpt for cpt in cpt_codes if acceptable and cpt not in acceptable]
        
        if mismatched:
            anomalies.append(AnomalyDetail(
                flag_type="SPECIALTY_MISMATCH",
                severity=SeverityLevel.MEDIUM,
                confidence=0.75,
                details={
                    "provider_specialty": provider_specialty,
                    "mismatched_cpts": mismatched,
                    "acceptable": acceptable
                },
                recommendation=f"Provider specialty '{provider_specialty}' may not match "
                             f"requested procedures. Verify credentials or request specialist referral."
            ))
        
        return anomalies

    # ========================================================================
    # MODULE 6: EXCESSIVE BILLING
    # ========================================================================
    
    async def _detect_excessive_billing(
        self,
        cpt_codes: List[str],
        billed_amount: float,
        provider_id: str
    ) -> List[AnomalyDetail]:
        """Detect unusually high billing using IQR and medical norms."""
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
        q1, q3 = amounts[n // 4], amounts[(3 * n) // 4]
        median = amounts[n // 2]
        iqr = q3 - q1
        upper_bound = q3 + (1.5 * iqr)
        extreme_bound = q3 + (3.0 * iqr)
        
        if billed_amount > extreme_bound:
            severity, confidence = SeverityLevel.HIGH, 0.92
        elif billed_amount > upper_bound:
            severity, confidence = SeverityLevel.MEDIUM, 0.85
        else:
            return anomalies
        
        for proc_type, (min_norm, max_norm) in self.medical_rules.billing_norms.items():
            if proc_type in main_cpt.lower() and billed_amount > max_norm:
                anomalies.append(AnomalyDetail(
                    flag_type="EXCESSIVE_BILLING",
                    severity=severity,
                    confidence=confidence,
                    details={
                        "cpt": main_cpt,
                        "billed_amount": billed_amount,
                        "median": median,
                        "q3": q3,
                        "upper_bound": round(upper_bound, 2),
                        "normal_range": (min_norm, max_norm),
                        "ratio_to_median": round(billed_amount / median, 2)
                    },
                    recommendation=f"Billed amount (${billed_amount:,.0f}) exceeds norms "
                                 f"(${min_norm}-${max_norm}). Request itemized breakdown."
                ))
        
        return anomalies

    # ========================================================================
    # MODULE 7: MISSING SUPPORTING DOCUMENTS
    # ========================================================================
    
    def _detect_missing_supporting_documents(
        self,
        cpt_codes: List[str],
        icd_codes: List[str],
        supporting_documents: List[str]
    ) -> List[AnomalyDetail]:
        """Detect missing critical supporting documentation."""
        anomalies = []
        
        required_docs: Set[str] = set()
        
        # Determine required docs based on procedure codes
        for cpt in cpt_codes:
            if cpt.startswith('22'):  # Spinal surgery
                required_docs.update(['MRI_Report', 'PT_Records', 'Specialist_Consult', 'EMG_NCS'])
            elif cpt.startswith(('27', '23')):  # Joint/shoulder surgery
                required_docs.update(['MRI_Report', 'PT_Records', 'Specialist_Consult'])
            elif cpt.startswith(('92', '93')):  # Cardiac
                required_docs.update(['Cardiology_Consult', 'EKG', 'Echo_Report'])
            elif cpt.startswith('7'):  # Imaging
                required_docs.update(['Prior_Imaging'])
        
        # Additional requirements by diagnosis
        for icd in icd_codes:
            if 'G89' in icd:  # Pain codes
                required_docs.update(['PT_Records', 'Medication_Trial'])
            elif icd[0] == 'M':  # Musculoskeletal
                required_docs.update(['Imaging_Report', 'PT_Records'])
        
        docs_present = set(supporting_documents)
        missing = required_docs - docs_present
        
        if missing:
            anomalies.append(AnomalyDetail(
                flag_type="MISSING_SUPPORTING_DOCUMENTS",
                severity=SeverityLevel.MEDIUM if len(missing) < 3 else SeverityLevel.HIGH,
                confidence=0.80,
                details={
                    "missing": list(missing),
                    "required": list(required_docs),
                    "present": list(docs_present)
                },
                recommendation=f"Missing: {', '.join(missing)}. Request submission before approval."
            ))
        
        return anomalies

    # ========================================================================
    # MODULE 8: TREATMENT SETTING MISMATCH
    # ========================================================================
    
    def _detect_treatment_setting_mismatch(
        self,
        cpt_codes: List[str],
        treatment_setting: str
    ) -> List[AnomalyDetail]:
        """Detect suspicious outpatient requests for major procedures."""
        anomalies = []
        
        inpatient_required = any(cpt.startswith(('22', '23', '24', '25', '27'))
                                for cpt in cpt_codes)
        
        if inpatient_required and treatment_setting.lower() == 'outpatient':
            anomalies.append(AnomalyDetail(
                flag_type="TREATMENT_SETTING_MISMATCH",
                severity=SeverityLevel.MEDIUM,
                confidence=0.85,
                details={
                    "cpt_codes": cpt_codes,
                    "setting": treatment_setting,
                    "expected": "inpatient"
                },
                recommendation="Major surgery as outpatient. Verify post-op monitoring and safety protocols."
            ))
        
        return anomalies

    # ========================================================================
    # MODULE 9: HIGH-RISK PROVIDER PATTERN
    # ========================================================================
    
    async def _score_provider_risk(self, provider_id: str) -> ProviderRiskResult:
        """Score provider risk across multiple dimensions."""
        pipeline = [
            {"$match": {"provider_id": provider_id}},
            {
                "$group": {
                    "_id": "$provider_id",
                    "total_claims": {"$sum": 1},
                    "denied_claims": {
                        "$sum": {"$cond": [{"$eq": ["$status", "DENIED"]}, 1, 0]}
                    },
                    "flagged_claims": {
                        "$sum": {"$cond": [{"$gt": [{"$size": "$anomaly_flags"}, 0]}, 1, 0]}
                    },
                    "amounts": {"$push": "$billed_amount"}
                }
            }
        ]
        
        result = await self.claims_collection.aggregate(pipeline).to_list(1)
        
        if not result:
            return ProviderRiskResult(provider_id, RiskLevel.LOW, 0.0, 0)
        
        stats = result[0]
        total = stats["total_claims"]
        denied = stats["denied_claims"]
        flagged = stats["flagged_claims"]
        amounts = stats["amounts"]
        
        denial_rate = denied / total if total else 0
        flagged_rate = flagged / total if total else 0
        
        high_cost_pct = 0.0
        if amounts:
            amounts_sorted = sorted(amounts)
            q3 = amounts_sorted[(3 * len(amounts_sorted)) // 4]
            high_cost_pct = sum(1 for a in amounts if a > q3 * 1.5) / len(amounts)
        
        risk_score = (denial_rate * 0.4) + (flagged_rate * 0.3) + (high_cost_pct * 0.3)
        
        if risk_score > 0.4:
            risk_level = RiskLevel.HIGH
        elif risk_score > 0.2:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW
        
        return ProviderRiskResult(
            provider_id=provider_id,
            risk_level=risk_level,
            denial_rate=denial_rate,
            total_claims=total,
            claim_reversal_rate=flagged_rate,
            high_cost_claims_pct=high_cost_pct
        )

    async def _detect_high_risk_provider_pattern(
        self,
        provider_id: str
    ) -> List[AnomalyDetail]:
        """Flag high-risk provider patterns."""
        anomalies = []
        provider_risk = await self._score_provider_risk(provider_id)
        
        if provider_risk.risk_level == RiskLevel.HIGH:
            anomalies.append(AnomalyDetail(
                flag_type="HIGH_RISK_PROVIDER_PATTERN",
                severity=SeverityLevel.HIGH,
                confidence=0.85,
                details={
                    "denial_rate": round(provider_risk.denial_rate, 3),
                    "flagged_rate": round(provider_risk.claim_reversal_rate, 3),
                    "high_cost_pct": round(provider_risk.high_cost_claims_pct, 3),
                    "total_claims": provider_risk.total_claims
                },
                recommendation=f"Provider shows elevated denial ({provider_risk.denial_rate:.1%}), "
                             f"flags ({provider_risk.claim_reversal_rate:.1%}), and high costs. "
                             f"Recommend enhanced scrutiny or education intervention."
            ))
        elif provider_risk.risk_level == RiskLevel.MEDIUM:
            anomalies.append(AnomalyDetail(
                flag_type="HIGH_RISK_PROVIDER_PATTERN",
                severity=SeverityLevel.MEDIUM,
                confidence=0.75,
                details={
                    "denial_rate": round(provider_risk.denial_rate, 3),
                    "flagged_rate": round(provider_risk.claim_reversal_rate, 3)
                },
                recommendation="Provider shows moderate risk. Monitor future submissions."
            ))
        
        return anomalies

    # ========================================================================
    # MODULE 10A: RAPID REPEAT PROCEDURES
    # ========================================================================
    
    async def _detect_rapid_repeat_procedures(
        self,
        patient_member_id: str,
        cpt_codes: List[str]
    ) -> List[AnomalyDetail]:
        """Detect repeated expensive procedures within 90 days."""
        anomalies = []
        if not cpt_codes:
            return anomalies
        
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)
        
        pipeline = [
            {
                "$match": {
                    "patient_member_id": patient_member_id,
                    "claim_date": {"$gte": ninety_days_ago}
                }
            },
            {"$unwind": "$cpt_codes"},
            {"$match": {"cpt_codes": {"$in": cpt_codes}}},
            {
                "$group": {
                    "_id": "$cpt_codes",
                    "claim_dates": {"$push": "$claim_date"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        async for doc in self.claims_collection.aggregate(pipeline):
            cpt = doc["_id"]
            count = doc["count"]
            dates = sorted(doc["claim_dates"])
            
            if count >= 2:
                for i in range(len(dates) - 1):
                    gap_days = (dates[i + 1] - dates[i]).days
                    
                    if gap_days < 30:
                        anomalies.append(AnomalyDetail(
                            flag_type="RAPID_REPEAT_PROCEDURES",
                            severity=SeverityLevel.HIGH,
                            confidence=0.90,
                            details={
                                "cpt": cpt,
                                "prior_date": dates[i].isoformat(),
                                "current_date": dates[i + 1].isoformat(),
                                "gap_days": gap_days,
                                "occurrences_90d": count
                            },
                            recommendation=f"Procedure {cpt} repeated {gap_days}d apart. "
                                         f"Verify medical necessity and patient recovery adequacy."
                        ))
        
        return anomalies

    # ========================================================================
    # MODULE 10B: IMPOSSIBLE COMBINATIONS
    # ========================================================================
    
    def _detect_impossible_combinations(
        self,
        icd_codes: List[str],
        cpt_codes: List[str]
    ) -> List[AnomalyDetail]:
        """Detect medically impossible clinical combinations."""
        anomalies = []
        
        impossible_pairs = [
            (["O80", "O82", "Z37"], ["54150", "54160"]),  # Pregnancy + vasectomy
            (["Z12.11"], ["39000"]),  # Bladder screening + prostatectomy
        ]
        
        for icd_group, cpt_group in impossible_pairs:
            has_icd = any(icd in icd_codes for icd in icd_group)
            has_cpt = any(cpt in cpt_codes for cpt in cpt_group)
            
            if has_icd and has_cpt:
                anomalies.append(AnomalyDetail(
                    flag_type="IMPOSSIBLE_COMBINATION",
                    severity=SeverityLevel.HIGH,
                    confidence=0.95,
                    details={
                        "icd_codes": icd_codes,
                        "cpt_codes": cpt_codes,
                        "issue": "Medically impossible or highly unlikely combination"
                    },
                    recommendation="Review for data entry errors or fraud. Contact provider for clarification."
                ))
        
        return anomalies

    # ========================================================================
    # COMPREHENSIVE SCORING
    # ========================================================================
    
    async def _calculate_comprehensive_scores(
        self,
        anomalies: List[AnomalyDetail],
        ocr_confidence: float,
        extraction_confidence: float,
        cpt_codes: List[str],
        icd_codes: List[str],
        billed_amount: float,
        provider_risk: ProviderRiskResult
    ) -> ScoringComponents:
        """Calculate multi-dimensional fraud risk scoring."""
        
        ocr_score = ocr_confidence * 100
        extraction_score = extraction_confidence * 100
        
        clinical_necessity = 100.0
        weak_necessity = sum(1 for a in anomalies if a.flag_type == "MEDICAL_NECESSITY_WEAK")
        insufficient_care = sum(1 for a in anomalies 
                               if a.flag_type == "INSUFFICIENT_CONSERVATIVE_CARE")
        mismatch = sum(1 for a in anomalies if a.flag_type == "ICD_CPT_MISMATCH")
        
        clinical_necessity -= weak_necessity * 15
        clinical_necessity -= insufficient_care * 20
        clinical_necessity -= mismatch * 25
        clinical_necessity = max(0, clinical_necessity)
        
        fraud_risk = 0.0
        severity_weights = {
            SeverityLevel.LOW: 10,
            SeverityLevel.MEDIUM: 25,
            SeverityLevel.HIGH: 50
        }
        
        for anomaly in anomalies:
            weight = severity_weights.get(anomaly.severity, 10)
            fraud_risk += weight * anomaly.confidence
        
        fraud_risk = min(100, fraud_risk)
        
        if provider_risk.risk_level == RiskLevel.HIGH:
            fraud_risk += 15
        elif provider_risk.risk_level == RiskLevel.MEDIUM:
            fraud_risk += 7
        
        fraud_risk = min(100, fraud_risk)
        
        approval_likelihood = 100 - fraud_risk
        approval_likelihood = (approval_likelihood * 0.6) + (clinical_necessity * 0.4)
        approval_likelihood = max(0, min(100, approval_likelihood))
        
        return ScoringComponents(
            ocr_confidence=ocr_score,
            extraction_confidence=extraction_score,
            clinical_necessity_score=clinical_necessity,
            fraud_risk_score=fraud_risk,
            approval_likelihood=approval_likelihood
        )

    # ========================================================================
    # RISK AND APPROVAL DETERMINATION
    # ========================================================================
    
    def _determine_fraud_risk_level(self, scoring: ScoringComponents) -> RiskLevel:
        """Determine fraud risk from scoring components."""
        if scoring.fraud_risk_score >= 70:
            return RiskLevel.HIGH
        elif scoring.fraud_risk_score >= 40:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def _calculate_approval_likelihood(self, scoring: ScoringComponents) -> float:
        """Calculate approval likelihood."""
        return scoring.approval_likelihood

    # ========================================================================
    # EXPLAINABILITY
    # ========================================================================
    
    def _generate_reasoning(
        self,
        anomalies: List[AnomalyDetail],
        scoring: ScoringComponents,
        fraud_risk_level: RiskLevel
    ) -> str:
        """Generate human-readable fraud assessment explanation."""
        lines = [
            f"Fraud Assessment: {fraud_risk_level.value} Risk",
            f"Approval Likelihood: {scoring.approval_likelihood:.1f}%",
            "",
            "Scoring Components:",
            f"  OCR Confidence: {scoring.ocr_confidence:.1f}%",
            f"  Extraction Confidence: {scoring.extraction_confidence:.1f}%",
            f"  Clinical Necessity: {scoring.clinical_necessity_score:.1f}%",
            f"  Fraud Risk Score: {scoring.fraud_risk_score:.1f}%",
            ""
        ]
        
        if anomalies:
            lines.append(f"Detected Anomalies ({len(anomalies)} total):")
            for i, a in enumerate(anomalies, 1):
                lines.append(f"  {i}. {a.flag_type} ({a.severity.value}): {a.recommendation}")
        else:
            lines.append("No significant anomalies detected.")
        
        return "\n".join(lines)

    def _generate_recommendations(
        self,
        anomalies: List[AnomalyDetail],
        fraud_risk_level: RiskLevel
    ) -> List[str]:
        """Generate actionable reviewer recommendations."""
        recommendations = []
        
        if fraud_risk_level == RiskLevel.HIGH:
            recommendations.extend([
                "DENY or request comprehensive provider documentation",
                "Conduct detailed medical necessity review",
                "Consider fraud investigation referral"
            ])
        elif fraud_risk_level == RiskLevel.MEDIUM:
            recommendations.extend([
                "Request additional documentation from provider",
                "Verify information with treating physician"
            ])
        
        for anomaly in anomalies:
            if anomaly.severity == SeverityLevel.HIGH:
                recommendations.append(f"Address {anomaly.flag_type}: {anomaly.recommendation}")
        
        return list(dict.fromkeys(recommendations))  # Remove duplicates

    # ========================================================================
    # DEFAULT CONFIGURATIONS
    # ========================================================================
    
    def _get_default_icd_cpt_mappings(self) -> Dict[str, List[str]]:
        """Default ICD-CPT justification mappings."""
        return {
            # Low back pain - conservative care only
            "M54.5": ["98941", "98942", "98943", "98944", "97161", "97162"],
            # Lumbar spondylosis - can justify fusion
            "M54.6": ["22630", "22631", "22632", "97161"],
            # Scoliosis - can justify fusion
            "M41.90": ["22630", "22631", "22632"],
            # Spinal stenosis with myelopathy - can justify decompression/fusion
            "M48.06": ["22630", "22631", "63047", "63048"],
            # Knee OA - can justify replacement
            "M17.11": ["27447", "27448"],
            # Pain codes - conservative care
            "G89.29": ["99213", "99214", "97161", "97162"],
        }

    def _get_default_specialty_mappings(self) -> Dict[str, List[str]]:
        """Default provider specialty to CPT mappings."""
        return {
            "orthopedic_surgery": ["22630", "22631", "27447", "27448", "20610"],
            "neurosurgery": ["22630", "22631", "63045", "63047"],
            "pain_management": ["20550", "20553", "64479", "64480"],
            "physical_medicine": ["99213", "97161", "97162"],
            "primary_care": ["99213", "99214", "99215"],
            "cardiology": ["92004", "92012", "99232"],
        }
