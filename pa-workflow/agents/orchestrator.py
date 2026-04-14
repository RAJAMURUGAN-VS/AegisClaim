import logging
import asyncio
from typing import TypedDict, List, Optional, Dict, Any
from uuid import UUID

from langgraph.graph import StateGraph, END, START

from .agent_a import DocumentProcessorAgent, AgentAOutput
from .agent_b import PolicyComplianceAgent, AgentBOutput
from .agent_c import FraudAnomalyAgent, AgentCOutput
from .policy_selector import PolicySelectorAgent
from ..core.database import get_db, get_mongo_db

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 1. Define the State
class PAWorkflowState(TypedDict):
    pa_id: UUID
    payer_id: UUID
    plan_id: str
    patient_member_id: str
    provider_npi: str
    cpt_codes: List[str]
    billed_amount: float
    document_paths: List[str]
    patient_data: dict
    prior_treatment_history: Optional[str]
    requested_quantity: Optional[int]
    
    # Agent outputs
    agent_a_output: Optional[AgentAOutput]
    agent_b_output: Optional[AgentBOutput]
    agent_c_output: Optional[AgentCOutput]
    
    # Decision fields
    final_score: Optional[float]
    decision: Optional[str]
    
    # Control fields
    retry_count: int
    missing_documents: List[str]
    error: Optional[str]
    status: str

# 2. Define Node Functions
async def run_policy_selector(state: PAWorkflowState) -> PAWorkflowState:
    logger.info(f"[{state['pa_id']}] Node: run_policy_selector")
    agent = PolicySelectorAgent()
    # Assuming document paths are simplified to just their type for this example
    submitted_doc_types = [path.split('/')[-1].split('.')[0] for path in state['document_paths']]
    
    policy_info = agent.check_policy_and_documents(state['plan_id'], submitted_doc_types)
    
    if not policy_info["pa_required"]:
        state['decision'] = "NOT_REQUIRED"
        state['status'] = "COMPLETED"
        return state
        
    state['missing_documents'] = policy_info["missing_documents"]
    return state

async def run_document_processor(state: PAWorkflowState) -> PAWorkflowState:
    logger.info(f"[{state['pa_id']}] Node: run_document_processor")
    
    if state['missing_documents']:
        if state['retry_count'] < 2:
            state['retry_count'] += 1
            state['status'] = "AWAITING_DOCUMENTS"
            logger.warning(f"[{state['pa_id']}] Missing documents. Awaiting upload. Retry attempt {state['retry_count']}.")
            return state
        else:
            state['decision'] = "AUTO_DENY"
            state['error'] = "INCOMPLETE_SUBMISSION"
            logger.error(f"[{state['pa_id']}] Missing documents after max retries. Auto-denying.")
            return state

    agent = DocumentProcessorAgent()
    output = agent.process_documents(state['pa_id'], state['document_paths'], state['patient_data'])
    state['agent_a_output'] = output
    
    if output.flagged_for_review:
        logger.warning(f"[{state['pa_id']}] Low OCR confidence detected. Flagging for review.")
        
    return state

async def run_compliance_and_fraud(state: PAWorkflowState) -> PAWorkflowState:
    logger.info(f"[{state['pa_id']}] Node: run_compliance_and_fraud (parallel)")
    
    db_session_gen = get_db()
    mongo_db_gen = get_mongo_db()
    
    async with await db_session_gen.__anext__() as db_session, await mongo_db_gen.__anext__() as mongo_db:
        agent_b = PolicyComplianceAgent(db_session)
        agent_c = FraudAnomalyAgent(mongo_db)

        agent_a_out = state['agent_a_output']
        if not agent_a_out:
            state['error'] = "Agent A output missing."
            raise ValueError("Agent A output is missing to proceed.")

        # Run agents B and C in parallel
        results = await asyncio.gather(
            agent_b.evaluate(
                pa_id=state['pa_id'],
                fhir_bundle=agent_a_out.fhir_bundle,
                patient_member_id=state['patient_member_id'],
                payer_id=state['payer_id'],
                plan_id=UUID(state['plan_id'])
            ),
            agent_c.analyze(
                pa_id=state['pa_id'],
                patient_member_id=state['patient_member_id'],
                provider_npi=state['provider_npi'],
                cpt_codes=state['cpt_codes'],
                billed_amount=state['billed_amount']
            )
        )
        state['agent_b_output'] = results[0]
        state['agent_c_output'] = results[1]
    
    return state

async def run_decision_engine(state: PAWorkflowState) -> PAWorkflowState:
    logger.info(f"[{state['pa_id']}] Node: run_decision_engine")
    
    if state.get('decision') == "AUTO_DENY":
        state['status'] = "DECIDED"
        return state

    agent_b_out = state['agent_b_output']
    agent_c_out = state['agent_c_output']

    if not agent_b_out or not agent_c_out:
        state['error'] = "Agent B or C output missing for decision."
        raise ValueError("Agent B or C output is missing.")

    policy_score = agent_b_out.policy_score
    clinical_match_score = agent_b_out.policy_score # Placeholder
    fraud_score = agent_c_out.fraud_score

    final_score = (policy_score * 0.40) + (clinical_match_score * 0.35) + (fraud_score * 0.25)
    state['final_score'] = final_score
    
    risk_flag = agent_c_out.risk_flag
    
    if risk_flag == "HIGH":
        state['decision'] = "HUMAN_REVIEW"
    elif final_score >= 85 and risk_flag == "LOW":
        state['decision'] = "AUTO_APPROVE"
    elif final_score < 60 or any(flag in agent_b_out.compliance_flags for flag in ["DIAGNOSIS_TREATMENT_MISMATCH"]):
        state['decision'] = "AUTO_DENY"
    else:
        state['decision'] = "HUMAN_REVIEW"
        
    state['status'] = "DECIDED"
    logger.info(f"[{state['pa_id']}] Decision made: {state['decision']} with score {final_score:.2f}")
    
    return state

async def handle_error(state: PAWorkflowState) -> PAWorkflowState:
    error = state.get("error", "Unknown error")
    logger.error(f"[{state['pa_id']}] Node: handle_error. Error: {error}")
    state['status'] = "ERROR"
    state['decision'] = "HUMAN_REVIEW"
    return state

# 3. Define Conditional Edge Functions
def should_retry_documents(state: PAWorkflowState) -> str:
    if state.get("error") == "INCOMPLETE_SUBMISSION":
        return "auto_deny"
    if state.get("status") == "AWAITING_DOCUMENTS":
        return "await_documents"
    return "proceed"

# 4. Build the Graph
graph = StateGraph(PAWorkflowState)

graph.add_node("policy_selector", run_policy_selector)
graph.add_node("document_processor", run_document_processor)
graph.add_node("compliance_and_fraud", run_compliance_and_fraud)
graph.add_node("decision_engine", run_decision_engine)
graph.add_node("handle_error", handle_error)

graph.set_entry_point("policy_selector")

graph.add_edge("policy_selector", "document_processor")
graph.add_conditional_edges(
    "document_processor",
    should_retry_documents,
    {
        "proceed": "compliance_and_fraud",
        "await_documents": END,
        "auto_deny": "decision_engine"
    }
)
graph.add_edge("compliance_and_fraud", "decision_engine")
graph.add_edge("decision_engine", END)

# This is a conceptual way to handle errors from any node
# In a real scenario, you might wrap each node call in a try-except block
# that updates the state with an error and then this node can act on it.
# For now, we assume unhandled exceptions are caught by the graph runner.
# A more explicit error path could be added from each node to 'handle_error'.

app = graph.compile()

# 5. Entry Point Function
async def run_pa_workflow(pa_request: dict) -> dict:
    """Initializes and runs the PA workflow for a given request."""
    initial_state = PAWorkflowState(
        pa_id=pa_request['pa_id'],
        payer_id=pa_request['payer_id'],
        plan_id=pa_request['plan_id'],
        patient_member_id=pa_request['patient_member_id'],
        provider_npi=pa_request['provider_npi'],
        cpt_codes=pa_request['cpt_codes'],
        billed_amount=pa_request.get('billed_amount', 0.0),
        document_paths=pa_request.get('document_paths', []),
        patient_data=pa_request.get('patient_data', {}),
        prior_treatment_history=pa_request.get('prior_treatment_history'),
        requested_quantity=pa_request.get('requested_quantity'),
        agent_a_output=None,
        agent_b_output=None,
        agent_c_output=None,
        final_score=None,
        decision=None,
        retry_count=0,
        missing_documents=[],
        error=None,
        status="STARTED"
    )
    
    final_state = await app.ainvoke(initial_state)
    return final_state
