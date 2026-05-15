from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Form, Body
from fastapi.responses import FileResponse
from uuid import UUID, uuid4, uuid5, NAMESPACE_DNS
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import json
import logging

from ..schemas import pa_schemas
from ..middleware.auth import require_role, User, get_current_user
from core.redis_client import get_redis_pool
from services.sonar_service import (
    chat_with_medical_context,
    analyze_extracted_text,
    extract_medical_codes_from_text,
    generate_followup_questions,
)
from services.report_service import generate_summary_report, save_report_to_file

logger = logging.getLogger(__name__)

router = APIRouter()

# A simple in-memory cache for demo purposes. Replace with Redis.
# In a real app, Redis would be used to store the state.
workflow_results: Dict[UUID, Any] = {}
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _coerce_uuid(raw: Optional[str], fallback_seed: str) -> UUID:
    if raw:
        try:
            return UUID(raw)
        except ValueError:
            return uuid5(NAMESPACE_DNS, raw)
    return uuid5(NAMESPACE_DNS, fallback_seed)


def _safe_to_dict(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return {k: _safe_to_dict(v) for k, v in value.__dict__.items()}
    if isinstance(value, dict):
        return {k: _safe_to_dict(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_safe_to_dict(v) for v in value]
    return value


def _serialize_pa_result(pa_id: UUID, result: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not result:
        return {
            "pa_id": str(pa_id),
            "status": "PROCESSING",
            "final_score": None,
            "risk_flag": None,
            "decision": None,
            "auth_code": None,
            "auth_valid_until": None,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "decided_at": None,
            "details": {
                "agent_a_output": None,
                "agent_b_output": None,
                "agent_c_output": None,
            },
        }

    if hasattr(result, '__dict__'):
        result = result.__dict__

    details = result.get("details") or {
        "agent_a_output": _safe_to_dict(result.get("agent_a_output", {})),
        "agent_b_output": _safe_to_dict(result.get("agent_b_output", {})),
        "agent_c_output": _safe_to_dict(result.get("agent_c_output", {})),
    }

    return {
        "pa_id": result.get("pa_id", str(pa_id)),
        "status": result.get("status", "UNKNOWN"),
        "final_score": result.get("final_score"),
        "risk_flag": _safe_to_dict(result.get("agent_c_output", {})).get("risk_flag") if result.get("agent_c_output") else None,
        "decision": result.get("decision"),
        "auth_code": "PA-2026-123456" if result.get("decision") == "AUTO_APPROVE" else None,
        "auth_valid_until": "2026-07-13" if result.get("decision") == "AUTO_APPROVE" else None,
        "created_at": result.get("created_at", datetime.utcnow().isoformat() + "Z"),
        "decided_at": result.get("decided_at") or (datetime.utcnow().isoformat() + "Z" if result.get("decision") else None),
        "details": details,
    }


async def run_workflow_and_store_results(pa_id: UUID, request_data: dict):
    """Helper function to run the workflow and cache the result."""
    try:
        logger.info(f"🚀 [WORKFLOW START] Starting background workflow for PA {pa_id}")
        logger.info(f"Request data documents: {request_data.get('document_paths', [])}")

        # Import lazily to keep router importable even if workflow dependencies
        # are not fully available at app startup.
        from agents.orchestrator import run_pa_workflow

        logger.info(f"⏳ [WORKFLOW] Calling run_pa_workflow for PA {pa_id}...")
        final_state = await run_pa_workflow(request_data)
        logger.info(f"✅ [WORKFLOW] Workflow completed for PA {pa_id}")
        logger.info(f"📊 [WORKFLOW] Final state keys: {list(final_state.keys())}")
        logger.info(f"📊 [WORKFLOW] Status: {final_state.get('status')}, Decision: {final_state.get('decision')}, Score: {final_state.get('final_score')}")

        # Check if Agent A output has Sonar data
        agent_a_output = final_state.get('agent_a_output')
        if agent_a_output:
            logger.info(f"📋 [WORKFLOW] Agent A output type: {type(agent_a_output)}")
            if hasattr(agent_a_output, 'text_analysis'):
                ta = agent_a_output.text_analysis
                logger.info(f"✅ [WORKFLOW] Agent A has text_analysis: {type(ta)}")
                if isinstance(ta, dict) and 'summary' in ta:
                    logger.info(f"🎯 [WORKFLOW] ✅ SONAR DATA FOUND IN AGENT A: {ta['summary'][:80]}...")
                else:
                    logger.warning(f"⚠️ [WORKFLOW] Agent A text_analysis not dict or missing summary: {ta}")
            else:
                logger.warning(f"⚠️ [WORKFLOW] Agent A output has no text_analysis attribute")
        else:
            logger.warning(f"⚠️ [WORKFLOW] No Agent A output in final state")

        # Merge workflow results with existing cache entry
        if pa_id in workflow_results:
            logger.info(f"📦 [WORKFLOW] Updating existing workflow_results entry for PA {pa_id}")
            workflow_results[pa_id].update({
                "status": final_state.get("status", "COMPLETED"),
                "final_score": final_state.get("final_score"),
                "decision": final_state.get("decision"),
                "agent_a_output": final_state.get("agent_a_output"),
                "agent_b_output": final_state.get("agent_b_output"),
                "agent_c_output": final_state.get("agent_c_output"),
                "decided_at": datetime.utcnow().isoformat() + "Z",
            })
            logger.info(f"✅ [WORKFLOW] Cache updated successfully")
        else:
            logger.warning(f"⚠️ [WORKFLOW] No existing workflow_results entry, creating new one")
            workflow_results[pa_id] = final_state
        
        try:
            redis = get_redis_pool()
            logger.info(f"💾 [WORKFLOW] Saving to Redis...")
            await redis.set(f"pa_result_{pa_id}", json.dumps(_safe_to_dict(workflow_results[pa_id])), ex=3600)
            logger.info(f"✅ [WORKFLOW] Redis save successful")
        except Exception as redis_err:
            # Redis may be unavailable in local dev; in-memory cache still works.
            logger.warning(f"⚠️ [WORKFLOW] Redis unavailable (this is OK for local dev): {redis_err}")

        logger.info(f"🎉 [WORKFLOW END] Workflow completed successfully for PA {pa_id}")
    except Exception as e:
        logger.error(f"❌ [WORKFLOW ERROR] Error in workflow for PA {pa_id}: {type(e).__name__}: {str(e)}", exc_info=True)
        # Update cache with error state
        if pa_id in workflow_results:
            workflow_results[pa_id].update({
                "status": "ERROR",
                "decision": "HUMAN_REVIEW",
                "error": str(e),
            })


@router.post("/pa/submit", response_model=pa_schemas.PAStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_pa_request(
    background_tasks: BackgroundTasks,
    patient_member_id: str = Form(...),
    payer_id: Optional[str] = Form(None),
    payer_name: Optional[str] = Form(None),
    plan_id: str = Form(...),
    provider_npi: str = Form(...),
    icd_codes: str = Form("[]"),
    cpt_codes: str = Form("[]"),
    date_of_service: str = Form(...),
    prior_treatment_history: Optional[str] = Form(None),
    medication_name: Optional[str] = Form(None),
    medication_dosage: Optional[str] = Form(None),
    medical_necessity_summary: Optional[str] = Form(None),
    clinical_summary: Optional[str] = Form(None),
    reason_for_claim: Optional[str] = Form(None),
    provider_notes: Optional[str] = Form(None),
    documents: List[UploadFile] = File(...),
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """
    Submit a new Prior Authorization request.
    Accepts the request and queues it for processing in the background.
    Includes clinical context fields for provider justification.
    """
    pa_id = uuid4()

    try:
        parsed_icd = json.loads(icd_codes) if icd_codes.strip().startswith("[") else [x.strip() for x in icd_codes.split(",") if x.strip()]
    except Exception:
        parsed_icd = [x.strip() for x in icd_codes.split(",") if x.strip()]
    try:
        parsed_cpt = json.loads(cpt_codes) if cpt_codes.strip().startswith("[") else [x.strip() for x in cpt_codes.split(",") if x.strip()]
    except Exception:
        parsed_cpt = [x.strip() for x in cpt_codes.split(",") if x.strip()]

    resolved_payer_id = _coerce_uuid(payer_id, payer_name or "default-payer")
    resolved_plan_uuid = _coerce_uuid(plan_id, f"{plan_id}-plan")

    saved_paths: List[str] = []
    pa_upload_dir = UPLOAD_DIR / str(pa_id)
    pa_upload_dir.mkdir(parents=True, exist_ok=True)
    for file in documents:
        file_name = file.filename or f"doc-{len(saved_paths)+1}.bin"
        destination = pa_upload_dir / file_name
        content = await file.read()
        destination.write_bytes(content)
        saved_paths.append(str(destination))

    # Prepare the initial state for the orchestrator
    request_data = {
        "patient_member_id": patient_member_id,
        "payer_id": resolved_payer_id,
        "plan_id": plan_id,
        "plan_uuid": resolved_plan_uuid,
        "provider_npi": provider_npi,
        "icd10_codes": parsed_icd,
        "cpt_codes": parsed_cpt,
        "date_of_service": date_of_service,
        "prior_treatment_history": prior_treatment_history,
        "medication_name": medication_name,
        "medication_dosage": medication_dosage,
        "medical_necessity_summary": medical_necessity_summary,
        "clinical_summary": clinical_summary,
        "reason_for_claim": reason_for_claim,
        "provider_notes": provider_notes,
        "patient_data": {
            "member_id": patient_member_id,
            "id": str(uuid4()),
        },
        "document_paths": saved_paths,
    }
    request_data.update({
        "pa_id": pa_id,
        "user_id": current_user.id,
        "billed_amount": 0.0,
    })

    # Initialize the result in cache immediately
    initial_result = {
        "pa_id": str(pa_id),
        "status": "PROCESSING",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "agent_a_output": None,
        "agent_b_output": None,
        "agent_c_output": None,
        "final_score": None,
        "risk_flag": None,
        "decision": None,
        "auth_code": None,
        "auth_valid_until": None,
        "decided_at": None,
        "details": {}
    }
    workflow_results[pa_id] = initial_result
    
    # Run the workflow in the background
    background_tasks.add_task(run_workflow_and_store_results, pa_id, request_data)
    
    print(f"User {current_user.id} submitted PA request {pa_id} for patient {patient_member_id}")
    
    # Return an immediate response
    return {
        "pa_id": pa_id,
        "status": "PROCESSING",
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

@router.get("/pa/{pa_id}", response_model=pa_schemas.PADetailResponse)
async def get_pa_details(pa_id: UUID, current_user: User = Depends(get_current_user)):
    """Get the detailed status and information for a specific PA request."""
    print(f"User {current_user.id} fetching details for PA {pa_id}")
    
    # Fetch result from our temporary cache
    result = workflow_results.get(pa_id)
    
    if not result:
        # Try to fetch from Redis if available
        try:
            redis = get_redis_pool()
            cached_result = await redis.get(f"pa_result_{pa_id}")
            if cached_result:
                result = json.loads(cached_result)
        except Exception:
            pass
    
    return _serialize_pa_result(pa_id, result)

@router.post("/pa/{pa_id}/documents", response_model=pa_schemas.DocumentUploadResponse)
async def upload_documents(
    pa_id: UUID,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """Upload additional/missing documents for a pending PA request."""
    # TODO: Store files in S3 or other blob storage
    # TODO: Update PA request status and notify the orchestrator
    filenames = [file.filename for file in files]
    print(f"User {current_user.id} uploaded {len(filenames)} files for PA {pa_id}: {filenames}")

    # Placeholder response
    return {
        "pa_id": pa_id,
        "uploaded_files": filenames,
        "missing_docs": [],
        "status": "PROCESSING"
    }

@router.get("/pa/{pa_id}/status", response_model=pa_schemas.PADetailResponse)
async def get_pa_status(pa_id: UUID, current_user: User = Depends(get_current_user)):
    """Lightweight endpoint to poll for the status of a PA request."""
    print(f"User {current_user.id} polling status for PA {pa_id}")

    result = workflow_results.get(pa_id)

    if not result:
        try:
            redis = get_redis_pool()
            cached_result = await redis.get(f"pa_result_{pa_id}")
            if cached_result:
                result = json.loads(cached_result)
        except Exception:
            pass

    return _serialize_pa_result(pa_id, result)

@router.get("/pa/queue/review", response_model=List[pa_schemas.PAStatusResponse])
async def get_review_queue(current_user: User = Depends(require_role(["ADJUDICATOR", "MEDICAL_DIRECTOR", "ADMIN"]))):
    """List all PA requests currently in the HUMAN REVIEW queue."""
    # TODO: Query PostgreSQL for all PAs with status='REVIEW'
    print(f"User {current_user.id} fetched the human review queue.")

    # Placeholder response
    return [
        {
            "pa_id": "e8a3b7b6-2b8a-4b3c-9c3d-5e4f6a7b8c9d",
            "status": "REVIEW",
            "final_score": 75.0,
            "risk_flag": "MEDIUM",
            "created_at": "2026-04-13T15:30:00Z"
        }
    ]

@router.post("/pa/{pa_id}/decision", response_model=pa_schemas.PAStatusResponse)
async def submit_adjudicator_decision(
    pa_id: UUID,
    request: pa_schemas.PADecisionRequest,
    current_user: User = Depends(require_role(["ADJUDICATOR", "MEDICAL_DIRECTOR"]))
):
    """Submit a final decision from a human adjudicator."""
    # TODO: Update PA request in PostgreSQL with decision
    # TODO: Log the override_reason and actor in the audit_log table
    print(f"Adjudicator {current_user.id} decided on PA {pa_id}: {request.decision}")

    # Placeholder response
    return {
        "pa_id": pa_id,
        "status": "DENIED" if request.decision == "HUMAN_DENY" else "APPROVED",
        "decision": request.decision,
        "created_at": "2026-04-14T10:00:00Z",
        "decided_at": "2026-04-14T11:00:00Z"
    }

@router.get("/pa/{pa_id}/auth-code", response_model=dict)
async def get_auth_code(pa_id: UUID, current_user: User = Depends(get_current_user)):
    """Retrieve the authorization code for an approved PA request."""
    # TODO: Fetch PA from PostgreSQL and verify it's approved
    # TODO: Return auth code only if status is 'APPROVED'
    print(f"User {current_user.id} requested auth code for PA {pa_id}")

    # Placeholder response
    return {"pa_id": pa_id, "auth_code": "PA-2026-123456"}

@router.post("/pa/{pa_id}/appeal", status_code=status.HTTP_202_ACCEPTED)
async def submit_appeal(
    pa_id: UUID,
    request: pa_schemas.PAAppealRequest,
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """Submit an appeal for a denied PA request."""
    # TODO: Update PA status to 'APPEALED' in PostgreSQL
    # TODO: Trigger an appeal processing workflow
    print(f"User {current_user.id} submitted an appeal for PA {pa_id}")

    # Placeholder response
    return {"pa_id": pa_id, "status": "APPEALED", "message": "Appeal has been queued for review."}


@router.post("/pa/{pa_id}/chat", response_model=pa_schemas.PAChatResponse)
async def chat_on_pa_context(
    pa_id: UUID,
    request: pa_schemas.PAChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Context-aware chat using current PA report, agent outputs, and Sonar medical persona."""
    # Load best-available PA context from memory/cache.
    result = workflow_results.get(pa_id)
    if not result:
        try:
            redis = get_redis_pool()
            cached_result = await redis.get(f"pa_result_{pa_id}")
            if cached_result:
                result = json.loads(cached_result)
        except Exception:
            result = None

    pa_context = {
        "pa_id": str(pa_id),
        "requested_by_user": current_user.id,
        "status": "PROCESSING",
        "decision": None,
        "final_score": None,
        "risk_flag": None,
        "details": {},
    }
    if result:
        if hasattr(result, "__dict__"):
            result = result.__dict__
        pa_context.update({
            "status": result.get("status", "PROCESSING"),
            "decision": result.get("decision"),
            "final_score": result.get("final_score"),
            "risk_flag": _safe_to_dict(result.get("agent_c_output", {})).get("risk_flag") if result.get("agent_c_output") else result.get("risk_flag"),
            "details": {
                "agent_a_output": _safe_to_dict(result.get("agent_a_output")),
                "agent_b_output": _safe_to_dict(result.get("agent_b_output")),
                "agent_c_output": _safe_to_dict(result.get("agent_c_output")),
                "report": result.get("details", {}),
            },
        })

    chat_result = chat_with_medical_context(request.message, pa_context)
    return {
        "pa_id": pa_id,
        "answer": chat_result.get("answer", "No response available."),
        "used_context_keys": chat_result.get("used_context_keys", []),
    }


@router.get("/pa/{pa_id}/report/download")
async def download_pa_report(
    pa_id: UUID,
    current_user: User = Depends(get_current_user)
):
    """
    Generate and download a professional summary report for a PA request.
    Returns a DOCX file with clinical analysis, medical codes, and decision summary.
    """
    # Load PA data from cache
    result = workflow_results.get(pa_id)
    if not result:
        try:
            redis = get_redis_pool()
            cached_result = await redis.get(f"pa_result_{pa_id}")
            if cached_result:
                result = json.loads(cached_result)
        except Exception:
            pass
    
    # Serialize the PA result
    pa_data = _serialize_pa_result(pa_id, result)
    
    # Extract Sonar analysis from agent A output if available
    sonar_analysis = None
    if result:
        logger.info(f"Extracting Sonar analysis for PA {pa_id}")
        # Convert result to dict if it's a dataclass
        result_dict = result if isinstance(result, dict) else _safe_to_dict(result)
        logger.info(f"Result dict keys: {list(result_dict.keys())}")
        
        # Look for text_analysis in agent_a_output
        details = result_dict.get('details') or {}
        logger.info(f"Details keys: {list(details.keys())}")
        agent_a_output = details.get('agent_a_output')
        logger.info(f"Agent A output type: {type(agent_a_output)}")
        
        if agent_a_output:
            # Handle both dict and dataclass formats
            if isinstance(agent_a_output, dict):
                logger.info(f"Agent A is dict, keys: {list(agent_a_output.keys())}")
                sonar_analysis = agent_a_output.get('text_analysis')
                logger.info(f"Sonar analysis from dict: {type(sonar_analysis)}")
            else:
                # Convert dataclass to dict if needed
                logger.info(f"Agent A is object, converting to dict")
                agent_a_dict = _safe_to_dict(agent_a_output)
                logger.info(f"Agent A dict keys: {list(agent_a_dict.keys())}")
                sonar_analysis = agent_a_dict.get('text_analysis')
                logger.info(f"Sonar analysis from converted dict: {type(sonar_analysis)}")
        
        # Fallback: try to get from raw result.agent_a_output
        if not sonar_analysis and hasattr(result, 'agent_a_output'):
            logger.info("Trying raw result.agent_a_output fallback")
            raw_agent_a = result.agent_a_output
            if hasattr(raw_agent_a, 'text_analysis'):
                sonar_analysis = raw_agent_a.text_analysis
                logger.info(f"Found sonar_analysis via raw attribute: {type(sonar_analysis)}")
            elif isinstance(raw_agent_a, dict) and 'text_analysis' in raw_agent_a:
                sonar_analysis = raw_agent_a['text_analysis']
                logger.info(f"Found sonar_analysis via raw dict: {type(sonar_analysis)}")

        if sonar_analysis:
            logger.info(f"✅ SONAR ANALYSIS FOUND: {type(sonar_analysis)}, keys: {list(sonar_analysis.keys()) if isinstance(sonar_analysis, dict) else 'N/A'}")
        else:
            logger.warning(f"⚠️ NO SONAR ANALYSIS FOUND for PA {pa_id}")
    else:
        logger.warning(f"⚠️ NO RESULT FOUND for PA {pa_id}")
    
    try:
        # Generate the report document
        report_bytes = generate_summary_report(pa_id, pa_data, sonar_analysis)
        
        # Save to disk for audit trail
        file_path = save_report_to_file(pa_id, report_bytes)
        
        # Return as downloadable file
        return FileResponse(
            path=file_path,
            filename=f"PA_{pa_id}_Summary_Report.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    except Exception as e:
        logger.error(f"Error generating report for PA {pa_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )


# Payer endpoints
@router.get("/payers")
async def get_payers(current_user: User = Depends(get_current_user)):
    """Get all active payers."""
    # TODO: Fetch from PostgreSQL
    return [
        {"id": "payer-001", "name": "Blue Cross Blue Shield", "code": "BCBS", "isActive": True},
        {"id": "payer-002", "name": "Aetna", "code": "AET", "isActive": True},
        {"id": "payer-003", "name": "UnitedHealthcare", "code": "UHC", "isActive": True},
        {"id": "payer-004", "name": "Cigna", "code": "CIG", "isActive": True},
    ]


@router.get("/plans")
async def get_plans(payer_id: str, current_user: User = Depends(get_current_user)):
    """Get plans by payer ID."""
    # TODO: Fetch from PostgreSQL based on payer_id
    plans_db = {
        "payer-001": [
            {"id": "plan-001", "payerId": "payer-001", "name": "Blue Cross PPO", "planCode": "BCBS-PPO", "planType": "PPO", "isActive": True},
            {"id": "plan-002", "payerId": "payer-001", "name": "Blue Cross HMO", "planCode": "BCBS-HMO", "planType": "HMO", "isActive": True},
        ],
        "payer-002": [
            {"id": "plan-003", "payerId": "payer-002", "name": "Aetna Open Choice", "planCode": "AET-OPEN", "planType": "PPO", "isActive": True},
            {"id": "plan-004", "payerId": "payer-002", "name": "Aetna Managed Choice", "planCode": "AET-MAN", "planType": "HMO", "isActive": True},
        ],
        "payer-003": [
            {"id": "plan-005", "payerId": "payer-003", "name": "UHC Choice Plus", "planCode": "UHC-CP", "planType": "PPO", "isActive": True},
        ],
        "payer-004": [
            {"id": "plan-006", "payerId": "payer-004", "name": "Cigna Connect", "planCode": "CIG-CON", "planType": "HMO", "isActive": True},
        ],
    }
    return plans_db.get(payer_id, [])


@router.get("/documents/requirements")
async def get_document_requirements(treatment_type: str, current_user: User = Depends(get_current_user)):
    """Get document requirements based on treatment type."""
    # TODO: Fetch from database based on treatment_type
    requirements_db = {
        "medication": {
            "required": ["Prescription", "Clinical Notes", "Lab Results"],
            "optional": ["Prior Treatment History", "Insurance Card"]
        },
        "procedure": {
            "required": ["Procedure Order", "Clinical Notes", "Imaging Reports"],
            "optional": ["Consent Form", "Insurance Card"]
        },
        "imaging": {
            "required": ["Imaging Order", "Clinical Justification"],
            "optional": ["Previous Imaging", "Insurance Card"]
        },
        "specialist": {
            "required": ["Referral Order", "Clinical Notes"],
            "optional": ["Patient History", "Insurance Card"]
        },
    }
    return requirements_db.get(treatment_type.lower(), {"required": [], "optional": []})


@router.post("/provider/extract-codes")
async def extract_medical_codes(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Extract ICD-10 (diagnosis) and CPT (procedure) codes from uploaded medical documents.
    
    Args:
        files: List of medical document files (PDF, JPEG, PNG, TIFF)
    
    Returns:
        {
            "icd10Codes": ["E11.9", "I10", ...],
            "cptCodes": ["99213", "27447", ...]
        }
    """
    import tempfile
    from pathlib import Path
    from services.ocr_service import extract_text_from_image, extract_text_from_pdf
    
    try:
        all_extracted_text = []
        
        # Extract text from all uploaded files
        for file in files:
            if file.filename is None:
                continue
                
            # Save file temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_file_path = temp_file.name
            
            try:
                # Extract text based on file type
                file_ext = Path(file.filename).suffix.lower()
                
                if file_ext == ".pdf":
                    text, confidence, page_count = extract_text_from_pdf(temp_file_path)
                elif file_ext in [".jpg", ".jpeg", ".png", ".tiff", ".tif"]:
                    text, confidence = extract_text_from_image(temp_file_path)
                else:
                    logger.warning(f"Unsupported file type: {file_ext}")
                    continue
                
                if text:
                    all_extracted_text.append(text)
                    logger.info(f"Extracted {len(text)} characters from {file.filename} (confidence: {confidence:.2f})")
            
            finally:
                # Clean up temporary file
                Path(temp_file_path).unlink(missing_ok=True)
        
        # Combine all extracted text and let Sonar produce exact codes when possible.
        combined_text = "\n\n".join(all_extracted_text)
        extraction_result = extract_medical_codes_from_text(combined_text)

        logger.info(
            "Extracted %s ICD-10 codes and %s CPT codes",
            len(extraction_result.get("icd10Codes", [])),
            len(extraction_result.get("cptCodes", [])),
        )

        return extraction_result
    
    except Exception as e:
        logger.error(f"Error extracting medical codes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract codes from documents: {str(e)}"
        )


@router.post("/provider/extract-sonar")
async def extract_sonar_payload(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """
    Extract OCR text, run medical code extraction and Sonar analysis,
    and return a composed Sonar-like payload for immediate frontend preview.
    """
    import tempfile
    from pathlib import Path
    from services.ocr_service import extract_text_from_image, extract_text_from_pdf
    from datetime import datetime

    try:
        all_extracted_text = []
        ocr_results = []

        for file in files:
            if file.filename is None:
                continue

            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_path = temp_file.name

            try:
                file_ext = Path(file.filename).suffix.lower()
                if file_ext == ".pdf":
                    text, confidence, page_count = extract_text_from_pdf(temp_path)
                elif file_ext in [".jpg", ".jpeg", ".png", ".tiff", ".tif"]:
                    text, confidence = extract_text_from_image(temp_path)
                    page_count = 1
                else:
                    logger.warning(f"Unsupported file type for sonar extraction: {file_ext}")
                    continue

                if text:
                    all_extracted_text.append(text)
                    ocr_results.append({
                        "document_path": str(temp_path),
                        "full_text": text,
                        "confidence_score": float(confidence) if confidence is not None else None,
                        "low_confidence": False,
                        "page_count": page_count,
                    })
            finally:
                Path(temp_path).unlink(missing_ok=True)

        combined_text = "\n\n".join(all_extracted_text)

        # Extract codes and run Sonar analysis
        codes = extract_medical_codes_from_text(combined_text)
        text_analysis = analyze_extracted_text(combined_text)

        payload = {
            "pa_id": None,
            "fhir_bundle": None,
            "medical_codes": {
                "icd10_codes": codes.get("icd10Codes", []),
                "cpt_codes": codes.get("cptCodes", []),
                "rxnorm_codes": [],
                "negated_codes": [],
                "extraction_confidence": None,
            },
            "text_analysis": text_analysis,
            "missing_fields": [],
            "overall_confidence": None,
            "flagged_for_review": False,
            "processed_at": datetime.utcnow().isoformat() + "Z",
        }

        return payload
    except Exception as exc:
        logger.error(f"Failed to build sonar payload: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/provider/extract-ocr")
async def extract_ocr_payload(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """
    Run OCR-only extraction on uploaded documents and return the OCR JSON results immediately.
    """
    import tempfile
    from pathlib import Path
    from services.ocr_service import extract_text_from_image, extract_text_from_pdf
    from datetime import datetime

    try:
        ocr_results = []

        for file in files:
            if file.filename is None:
                continue

            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_path = temp_file.name

            try:
                file_ext = Path(file.filename).suffix.lower()
                if file_ext == ".pdf":
                    text, confidence, page_count = extract_text_from_pdf(temp_path)
                elif file_ext in [".jpg", ".jpeg", ".png", ".tiff", ".tif"]:
                    text, confidence = extract_text_from_image(temp_path)
                    page_count = 1
                else:
                    logger.warning(f"Unsupported file type for ocr extraction: {file_ext}")
                    continue

                if text:
                    ocr_results.append({
                        "document_path": str(temp_path),
                        "full_text": text,
                        "confidence_score": float(confidence) if confidence is not None else None,
                        "low_confidence": False,
                        "page_count": page_count,
                    })
            finally:
                Path(temp_path).unlink(missing_ok=True)

        return {"ocr_results": ocr_results, "processed_at": datetime.utcnow().isoformat() + "Z"}
    except Exception as exc:
        logger.error(f"Failed to run OCR-only extraction: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/provider/generate-questions", response_model=pa_schemas.QuestionGenerationResponse)
async def provider_generate_questions(
    context: Dict[str, Any] = Body(...),
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """Generate targeted follow-up questions for the provider based on PA context."""
    try:
        # Ensure context is serializable
        context = {k: v for k, v in (context or {}).items()}
        result = generate_followup_questions(context)
        # Basic validation of result shape
        questions = result.get("questions") or []
        if not isinstance(questions, list):
            raise ValueError("Invalid question format returned from generator")
        return {"questions": questions, "metadata": result.get("metadata", {})}
    except Exception as exc:
        logger.error(f"Error generating questions: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/provider/ai-review", response_model=pa_schemas.AIReviewResponse)
async def provider_ai_review(
    submission: Dict[str, Any] = Body(...),
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """Run an AI-assisted review on the submission. Returns score, issues, and suggestions.

    Initial implementation is a lightweight rule-based check; can be extended to call Sonar.
    """
    try:
        issues = []
        suggestions = []
        score = 100.0

        # Rule: required clinical fields
        required_fields = ["medical_necessity_summary", "clinical_summary", "reason_for_claim"]
        for field in required_fields:
            if not submission.get(field):
                issues.append({"code": "MISSING_FIELD", "message": f"{field} is missing", "severity": "warning"})
                score -= 20.0
                suggestions.append({"field": field, "suggestedText": "Please provide concise clinical justification."})

        # Rule: check documents attached
        docs = submission.get("documents") or submission.get("document_paths") or []
        if not docs:
            issues.append({"code": "MISSING_DOCS", "message": "No supporting documents attached", "severity": "warning"})
            score -= 10.0

        # Normalise score
        score = max(0.0, min(100.0, score))
        pass_review = score >= 60.0

        return {
            "score": score,
            "pass_review": pass_review,
            "issues": issues,
            "suggestions": suggestions,
            "model_metadata": {"engine": "rule-based-v1"},
        }
    except Exception as exc:
        logger.error(f"AI review failed: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="AI review failed")



