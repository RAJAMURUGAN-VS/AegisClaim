"""
Test to trace Sonar data through the full workflow caching pipeline.
This simulates what happens when a PA is submitted, processed, and then downloaded.
"""
import json
import logging
from uuid import uuid4
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from dataclasses import dataclass, field
from typing import Dict, Any, List

@dataclass
class MedicalCodes:
    icd10_codes: List[str] = field(default_factory=list)
    cpt_codes: List[str] = field(default_factory=list)
    rxnorm_codes: List[str] = field(default_factory=list)

@dataclass
class OCRResult:
    text: str
    confidence_score: float = 0.0
    low_confidence: bool = False

@dataclass
class AgentAOutput:
    pa_id: str
    fhir_bundle: Dict[str, Any] = field(default_factory=dict)
    ocr_results: List[OCRResult] = field(default_factory=list)
    medical_codes: MedicalCodes = field(default_factory=MedicalCodes)
    text_analysis: Dict[str, Any] = field(default_factory=dict)
    missing_fields: List[str] = field(default_factory=list)
    overall_confidence: float = 0.0
    flagged_for_review: bool = False
    processed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

import sys
sys.path.insert(0, '/c:/Users/RAJA MURUGAN VS/Desktop/AegisClaim/pa-workflow/backend')
from api.routes.pa_routes import _safe_to_dict

def test_workflow_pipeline():
    """Test the full pipeline of storing and retrieving Sonar data."""

    logger.info("="*70)
    logger.info("TESTING SONAR DATA FLOW THROUGH WORKFLOW")
    logger.info("="*70)

    pa_id = str(uuid4())

    # Step 1: Simulate Agent A output with Sonar data
    logger.info("\n[STEP 1] Creating Agent A output with Sonar analysis...")
    sonar_response = {
        "summary": "Patient has advanced osteoarthritis with clear medical necessity for knee replacement",
        "medical_necessity_signals": ["Severe joint damage", "Failed conservative treatment", "Progressive symptoms"],
        "risks": ["Surgical risk", "Post-op complications"],
        "recommendations": ["Proceed with TKA", "Pre-operative cardiac clearance"]
    }

    agent_a_output = AgentAOutput(
        pa_id=pa_id,
        fhir_bundle={"resourceType": "Bundle"},
        ocr_results=[OCRResult(text="Sample OCR text", confidence_score=0.95)],
        medical_codes=MedicalCodes(
            icd10_codes=["M17.11", "M25.461"],
            cpt_codes=["27447"]
        ),
        text_analysis=sonar_response,
        overall_confidence=0.87,
        flagged_for_review=False
    )

    logger.info("Agent A output created")
    logger.info(f"  - text_analysis field populated: {bool(agent_a_output.text_analysis)}")
    logger.info(f"  - Sonar summary: {agent_a_output.text_analysis.get('summary', 'N/A')[:60]}...")

    # Step 2: Simulate workflow result structure
    logger.info("\n[STEP 2] Creating workflow result (as it's stored in workflow_results dict)...")
    workflow_result = {
        "pa_id": pa_id,
        "status": "COMPLETED",
        "final_score": 87.5,
        "decision": "AUTO_APPROVE",
        "details": {
            "agent_a_output": agent_a_output,
            "agent_b_output": None,
            "agent_c_output": None,
        }
    }

    logger.info("Workflow result created")
    logger.info(f"  - agent_a_output type: {type(workflow_result['details']['agent_a_output'])}")
    logger.info(f"  - text_analysis in agent_a_output: {bool(workflow_result['details']['agent_a_output'].text_analysis)}")

    # Step 3: Simulate Redis serialization
    logger.info("\n[STEP 3] Serializing for Redis (using _safe_to_dict)...")
    serialized = _safe_to_dict(workflow_result)

    logger.info("Serialized result")
    logger.info(f"  - Top-level keys: {list(serialized.keys())}")
    logger.info(f"  - details keys: {list(serialized['details'].keys())}")
    agent_a_dict = serialized['details']['agent_a_output']
    logger.info(f"  - agent_a_output type after serialization: {type(agent_a_dict)}")
    logger.info(f"  - agent_a_output keys: {list(agent_a_dict.keys()) if isinstance(agent_a_dict, dict) else 'NOT A DICT'}")

    if isinstance(agent_a_dict, dict):
        logger.info(f"  - 'text_analysis' in agent_a_output: {'text_analysis' in agent_a_dict}")
        if 'text_analysis' in agent_a_dict:
            ta = agent_a_dict['text_analysis']
            logger.info(f"  - text_analysis type: {type(ta)}")
            logger.info(f"  - text_analysis keys: {list(ta.keys()) if isinstance(ta, dict) else 'NOT A DICT'}")
            logger.info(f"  - text_analysis summary: {ta.get('summary', 'N/A')[:60] if isinstance(ta, dict) else 'N/A'}...")

    # Step 4: Simulate Redis JSON deserialization
    logger.info("\n[STEP 4] JSON serialization (simulating Redis store/retrieve)...")
    json_str = json.dumps(serialized, default=str)
    deserialized = json.loads(json_str)

    logger.info("After JSON round-trip")
    logger.info(f"  - Top-level keys: {list(deserialized.keys())}")
    logger.info(f"  - details keys: {list(deserialized['details'].keys())}")
    agent_a_json = deserialized['details']['agent_a_output']
    logger.info(f"  - agent_a_output type: {type(agent_a_json)}")
    logger.info(f"  - agent_a_output keys: {list(agent_a_json.keys()) if isinstance(agent_a_json, dict) else 'NOT A DICT'}")

    if isinstance(agent_a_json, dict):
        logger.info(f"  - 'text_analysis' in agent_a_output: {'text_analysis' in agent_a_json}")
        if 'text_analysis' in agent_a_json:
            ta = agent_a_json['text_analysis']
            logger.info(f"  - text_analysis type: {type(ta)}")
            logger.info(f"  - text_analysis content: {ta}")

    # Step 5: Simulate Sonar extraction logic
    logger.info("\n[STEP 5] Extracting Sonar analysis (simulating download endpoint)...")
    sonar_analysis = None
    result_dict = deserialized
    details = result_dict.get('details') or {}
    agent_a_output_data = details.get('agent_a_output')

    logger.info(f"  - agent_a_output_data type: {type(agent_a_output_data)}")
    logger.info(f"  - agent_a_output_data: {agent_a_output_data}")

    if agent_a_output_data:
        if isinstance(agent_a_output_data, dict):
            sonar_analysis = agent_a_output_data.get('text_analysis')
            logger.info(f"  - Extracted from dict: {type(sonar_analysis)}")

    if sonar_analysis:
        logger.info("\n✅ SUCCESS! Sonar analysis extracted:")
        logger.info(f"  - Type: {type(sonar_analysis)}")
        logger.info(f"  - Keys: {list(sonar_analysis.keys()) if isinstance(sonar_analysis, dict) else 'N/A'}")
        logger.info(f"  - Summary: {sonar_analysis.get('summary', 'N/A')[:80]}...")
    else:
        logger.error("\n❌ FAILED! Sonar analysis not found")
        logger.error("  - Checked in details.agent_a_output.text_analysis")
        logger.error(f"  - agent_a_output_data: {agent_a_output_data}")

if __name__ == "__main__":
    test_workflow_pipeline()
