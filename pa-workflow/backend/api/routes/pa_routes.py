from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Form
from uuid import UUID, uuid4, uuid5, NAMESPACE_DNS
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import json
import logging

from ..schemas import pa_schemas
from ..middleware.auth import require_role, User, get_current_user
from core.redis_client import get_redis_pool
from services.sonar_service import chat_with_medical_context

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
        # Import lazily to keep router importable even if workflow dependencies
        # are not fully available at app startup.
        from agents.orchestrator import run_pa_workflow

        final_state = await run_pa_workflow(request_data)
        # Merge workflow results with existing cache entry
        if pa_id in workflow_results:
            workflow_results[pa_id].update({
                "status": final_state.get("status", "COMPLETED"),
                "final_score": final_state.get("final_score"),
                "decision": final_state.get("decision"),
                "agent_a_output": final_state.get("agent_a_output"),
                "agent_b_output": final_state.get("agent_b_output"),
                "agent_c_output": final_state.get("agent_c_output"),
                "decided_at": datetime.utcnow().isoformat() + "Z",
            })
        else:
            workflow_results[pa_id] = final_state
        
        try:
            redis = get_redis_pool()
            await redis.set(f"pa_result_{pa_id}", json.dumps(_safe_to_dict(workflow_results[pa_id])), ex=3600)
        except Exception:
            # Redis may be unavailable in local dev; in-memory cache still works.
            pass
    except Exception as e:
        logger.error(f"Error in workflow for PA {pa_id}: {str(e)}")
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
    documents: List[UploadFile] = File(...),
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """
    Submit a new Prior Authorization request.
    Accepts the request and queues it for processing in the background.
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


