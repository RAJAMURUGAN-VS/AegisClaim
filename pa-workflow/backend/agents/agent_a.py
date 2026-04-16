import time
import re
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID

from core.config import settings
from core.exceptions import OCRException
from services.ocr_service import extract_text_from_image, extract_text_from_pdf
from services.sonar_service import analyze_extracted_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Dataclasses for Agent A Output ---

@dataclass
class OCRResult:
    """Stores the result of OCR processing for a single document."""
    document_path: str
    text: str
    confidence_score: float
    low_confidence: bool
    page_count: int

@dataclass
class MedicalCodes:
    """Stores medical codes extracted from text."""
    icd10_codes: List[str] = field(default_factory=list)
    cpt_codes: List[str] = field(default_factory=list)
    rxnorm_codes: List[str] = field(default_factory=list)
    negated_codes: List[str] = field(default_factory=list)
    extraction_confidence: float = 1.0  # Placeholder

@dataclass
class AgentAOutput:
    """The final output structure for the Document Processor Agent."""
    pa_id: UUID
    fhir_bundle: Dict[str, Any]
    ocr_results: List[OCRResult]
    medical_codes: MedicalCodes
    text_analysis: Dict[str, Any] = field(default_factory=dict)
    missing_fields: List[str] = field(default_factory=list)
    overall_confidence: float = 0.0
    flagged_for_review: bool = False
    processed_at: datetime = field(default_factory=datetime.utcnow)


class DocumentProcessorAgent:
    """
    Agent A: Processes uploaded documents to extract and structure clinical data.
    """
    def __init__(self):
        # Placeholder for RxNorm keywords
        self.rxnorm_keywords = ["Lisinopril", "Metformin", "Amlodipine"]

    def process_documents(self, pa_id: UUID, document_paths: List[str], patient_data: dict) -> AgentAOutput:
        """
        Main entry point to process all documents for a PA request.
        """
        logger.info(f"[{pa_id}] Starting document processing for {len(document_paths)} documents.")
        
        all_ocr_results: List[OCRResult] = []
        full_text = ""
        
        for doc_path in document_paths:
            try:
                ocr_result = self._run_ocr(doc_path)
                all_ocr_results.append(ocr_result)
                if ocr_result.low_confidence:
                    logger.warning(f"[{pa_id}] Document '{doc_path}' has low OCR confidence: {ocr_result.confidence_score:.2f}")
                full_text += ocr_result.text + "\n"
            except OCRException as e:
                logger.error(f"[{pa_id}] Failed to process document '{doc_path}': {e}")
                # Decide if we should continue or fail
                continue

        cleaned_text = self._clean_text(full_text)
        text_analysis = analyze_extracted_text(cleaned_text)
        extracted_codes = self._extract_medical_codes(cleaned_text)
        fhir_bundle = self._build_fhir_bundle(pa_id, patient_data, extracted_codes)

        overall_confidence = sum(res.confidence_score for res in all_ocr_results) / len(all_ocr_results) if all_ocr_results else 0.0
        flagged_for_review = any(res.low_confidence for res in all_ocr_results)

        logger.info(f"[{pa_id}] Document processing completed. Overall confidence: {overall_confidence:.2f}")

        return AgentAOutput(
            pa_id=pa_id,
            fhir_bundle=fhir_bundle,
            ocr_results=all_ocr_results,
            medical_codes=extracted_codes,
            text_analysis=text_analysis,
            overall_confidence=overall_confidence,
            flagged_for_review=flagged_for_review,
        )

    def _run_ocr(self, document_path: str) -> OCRResult:
        """
        Run OCR on a document using open-source OCR.
        Uses pytesseract + pdf2image for local extraction.
        """
        file_extension = document_path.split('.')[-1].lower()
        
        if file_extension in ['jpg', 'jpeg', 'png']:
            return self._run_sync_ocr(document_path)
        elif file_extension == 'pdf':
            return self._run_async_ocr(document_path)
        else:
            raise OCRException(f"Unsupported file type: {file_extension}")

    def _run_sync_ocr(self, document_path: str) -> OCRResult:
        logger.info(f"Running local OCR for image: {document_path}")
        try:
            text, avg_confidence = extract_text_from_image(document_path)
            
            return OCRResult(
                document_path=document_path,
                text=text,
                confidence_score=avg_confidence,
                low_confidence=avg_confidence < settings.OCR_CONFIDENCE_THRESHOLD,
                page_count=1
            )
        except Exception as e:
            raise OCRException(f"Local OCR failed for {document_path}: {e}")

    def _run_async_ocr(self, document_path: str) -> OCRResult:
        logger.info(f"Running local OCR for PDF: {document_path}")
        try:
            text, avg_confidence, page_count = extract_text_from_pdf(document_path)

            return OCRResult(
                document_path=document_path,
                text=text,
                confidence_score=avg_confidence,
                low_confidence=avg_confidence < settings.OCR_CONFIDENCE_THRESHOLD,
                page_count=page_count
            )

        except Exception as e:
            raise OCRException(f"Local PDF OCR failed for {document_path}: {e}")

    def _clean_text(self, raw_text: str) -> str:
        """Cleans raw OCR text."""
        text = raw_text
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        # Remove boilerplate (example patterns)
        text = re.sub(r'Page \d+ of \d+', '', text, flags=re.IGNORECASE)
        # Remove non-ASCII characters, allowing some symbols
        text = re.sub(r'[^\x00-\x7F°µ]+', '', text)
        return text

    def _extract_medical_codes(self, text: str) -> MedicalCodes:
        """Extracts medical codes using regex and keyword matching."""
        # ICD-10: e.g., A12.3, Z99.89
        icd10_pattern = r'\b[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?\b'
        # CPT: e.g., 99213, 12345F
        cpt_pattern = r'\b[0-9]{4}[0-9A-Z][FTU]?\b'
        
        icd10_codes = re.findall(icd10_pattern, text)
        cpt_codes = re.findall(cpt_pattern, text)
        
        # Placeholder for RxNorm
        rxnorm_codes = [drug for drug in self.rxnorm_keywords if re.search(r'\b' + drug + r'\b', text, re.IGNORECASE)]
        
        # Simple negation detection
        negated_codes = []
        negation_pattern = r'\b(no|denies|without|negative for)\b\s*(?:\w+\s*){0,3}'
        
        for code in icd10_codes + cpt_codes:
            if re.search(negation_pattern + re.escape(code), text, re.IGNORECASE):
                negated_codes.append(code)

        return MedicalCodes(
            icd10_codes=list(set(icd10_codes) - set(negated_codes)),
            cpt_codes=list(set(cpt_codes) - set(negated_codes)),
            rxnorm_codes=list(set(rxnorm_codes)),
            negated_codes=list(set(negated_codes))
        )

    def _build_fhir_bundle(self, pa_id: UUID, patient_data: dict, medical_codes: MedicalCodes) -> Dict[str, Any]:
        """Builds a FHIR R4 Bundle resource from extracted data."""
        entries = []
        
        # Patient Resource
        patient_resource = {
            "fullUrl": f"urn:uuid:{patient_data.get('id', uuid.uuid4())}",
            "resource": {
                "resourceType": "Patient",
                "id": patient_data.get('id', str(uuid.uuid4())),
                "identifier": [{
                    "system": "http://example.com/member_id",
                    "value": patient_data.get('member_id')
                }]
            }
        }
        entries.append(patient_resource)

        # Condition Resources (ICD-10)
        for code in medical_codes.icd10_codes:
            entries.append({
                "fullUrl": f"urn:uuid:{uuid.uuid4()}",
                "resource": {
                    "resourceType": "Condition",
                    "code": {"coding": [{"system": "http://hl7.org/fhir/sid/icd-10-cm", "code": code}]},
                    "subject": {"reference": patient_resource['fullUrl']}
                }
            })

        # Procedure Resources (CPT)
        for code in medical_codes.cpt_codes:
            entries.append({
                "fullUrl": f"urn:uuid:{uuid.uuid4()}",
                "resource": {
                    "resourceType": "Procedure",
                    "code": {"coding": [{"system": "http://www.ama-assn.org/go/cpt", "code": code}]},
                    "subject": {"reference": patient_resource['fullUrl']}
                }
            })

        # MedicationRequest Resource (RxNorm)
        if medical_codes.rxnorm_codes:
            entries.append({
                "fullUrl": f"urn:uuid:{uuid.uuid4()}",
                "resource": {
                    "resourceType": "MedicationRequest",
                    "medicationCodeableConcept": {
                        "coding": [{
                            "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                            "display": drug
                        } for drug in medical_codes.rxnorm_codes]
                    },
                    "subject": {"reference": patient_resource['fullUrl']}
                }
            })

        return {
            "resourceType": "Bundle",
            "id": str(uuid.uuid4()),
            "type": "collection",
            "entry": entries
        }
