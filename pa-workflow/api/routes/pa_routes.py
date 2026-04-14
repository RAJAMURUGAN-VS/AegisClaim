from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from uuid import UUID, uuid4
from typing import List, Dict, Any

from ..schemas import pa_schemas
from ..middleware.auth import require_role, User, get_current_user
from ...agents.orchestrator import run_pa_workflow
from ...core.redis_client import get_redis_client

router = APIRouter()

# A simple in-memory cache for demo purposes. Replace with Redis.
# In a real app, Redis would be used to store the state.
workflow_results: Dict[UUID, Any] = {}


async def run_workflow_and_store_results(pa_id: UUID, request_data: dict):
    """Helper function to run the workflow and cache the result."""
    final_state = await run_pa_workflow(request_data)
    redis = await get_redis_client()
    await redis.set(f"pa_result_{pa_id}", str(final_state), ex=3600) # Cache for 1 hour
    # For simplicity, also keeping it in memory for this example
    workflow_results[pa_id] = final_state


@router.post("/pa/submit", response_model=pa_schemas.PAStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_pa_request(
    request: pa_schemas.PASubmitRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    """
    Submit a new Prior Authorization request.
    Accepts the request and queues it for processing in the background.
    """
    pa_id = uuid4()
    
    # Prepare the initial state for the orchestrator
    request_data = request.model_dump()
    request_data.update({
        "pa_id": pa_id,
        "user_id": current_user.id,
        # In a real scenario, document paths would come from a file upload step
        # For now, we'll simulate them based on the request.
        "document_paths": ["clinical_notes.pdf", "prescription.pdf"]
    })

    # Run the workflow in the background
    background_tasks.add_task(run_workflow_and_store_results, pa_id, request_data)
    
    print(f"User {current_user.id} submitted PA request {pa_id} for patient {request.patient_member_id}")
    
    # Return an immediate response
    return {
        "pa_id": pa_id,
        "status": "PENDING",
        "created_at": "2026-04-14T10:00:00Z" # Placeholder
    }

@router.get("/pa/{pa_id}", response_model=pa_schemas.PADetailResponse)
async def get_pa_details(pa_id: UUID, current_user: User = Depends(get_current_user)):
    """Get the detailed status and information for a specific PA request."""
    print(f"User {current_user.id} fetching details for PA {pa_id}")
    
    # Fetch result from our temporary cache
    result = workflow_results.get(pa_id)
    
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PA request not found or still processing.")

    # Map the final state from the orchestrator to the API response schema
    return {
        "pa_id": pa_id,
        "status": result.get("status", "UNKNOWN"),
        "final_score": result.get("final_score"),
        "risk_flag": result.get("agent_c_output", {}).get("risk_flag"),
        "decision": result.get("decision"),
        "auth_code": "PA-2026-123456" if result.get("decision") == "AUTO_APPROVE" else None,
        "auth_valid_until": "2026-07-13" if result.get("decision") == "AUTO_APPROVE" else None,
        "created_at": "2026-04-14T10:00:00Z", # Placeholder
        "decided_at": "2026-04-14T10:01:30Z", # Placeholder
        "details": {
            "agent_a_output": result.get("agent_a_output"),
            "agent_b_output": result.get("agent_b_output"),
            "agent_c_output": result.get("agent_c_output"),
        }
    }

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

@router.get("/pa/{pa_id}/status", response_model=pa_schemas.PAStatusResponse)
async def get_pa_status(pa_id: UUID, current_user: User = Depends(get_current_user)):
    """Lightweight endpoint to poll for the status of a PA request."""
    # TODO: Fetch only the status and key fields from PostgreSQL
    print(f"User {current_user.id} polling status for PA {pa_id}")

    # Placeholder response
    return {
        "pa_id": pa_id,
        "status": "SCORING",
        "created_at": "2026-04-14T10:00:00Z"
    }

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
