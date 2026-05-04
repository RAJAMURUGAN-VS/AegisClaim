"""
Data Routes - Fetch dynamic reference data from Neon PostgreSQL database
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings
from ..middleware.auth import get_current_user, User

logger = logging.getLogger(__name__)
router = APIRouter()

# Database connection helper
def get_db_connection():
    """Get a connection to the Neon PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            host=settings.POSTGRES_HOST,
            database=settings.POSTGRES_DB,
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            port=settings.POSTGRES_PORT,
            sslmode="require",
            channel_binding="require"
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        )


@router.get("/data/users")
async def get_all_users(current_user: User = Depends(get_current_user)):
    """Get all active users from the database."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT id, user_id, email, name, role, organization, is_active
            FROM users
            WHERE is_active = true
            ORDER BY created_at DESC
        """)
        
        users = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(row) for row in users]
    except Exception as e:
        logger.error(f"Error fetching users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching users"
        )


@router.get("/data/payers")
async def get_payers(current_user: User = Depends(get_current_user)):
    """Get all payers from the database (from plans table)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT DISTINCT payer_id as id, 
                   SUBSTRING(plan_name, 1, POSITION(' ' IN plan_name) - 1) as name,
                   payer_id as code
            FROM plans
            ORDER BY payer_id
        """)
        
        payers = cur.fetchall()
        cur.close()
        conn.close()
        
        # Transform the response
        result = []
        seen = set()
        for row in payers:
            payer_id = row['id']
            if payer_id not in seen:
                seen.add(payer_id)
                result.append({
                    "id": payer_id,
                    "name": row['name'] if row['name'] else payer_id,
                    "code": payer_id,
                    "isActive": True
                })
        
        return result
    except Exception as e:
        logger.error(f"Error fetching payers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching payers"
        )


@router.get("/data/plans")
async def get_plans_by_payer(payer_id: str, current_user: User = Depends(get_current_user)):
    """Get plans by payer ID from the database."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("""
            SELECT plan_id as id,
                   payer_id as "payerId",
                   plan_name as name,
                   plan_id as "planCode",
                   'PPO' as "planType",
                   true as "isActive"
            FROM plans
            WHERE payer_id = %s
            ORDER BY plan_name
        """, (payer_id,))
        
        plans = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(row) for row in plans]
    except Exception as e:
        logger.error(f"Error fetching plans: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching plans"
        )


@router.get("/data/procedures")
async def get_procedures(plan_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get procedures from the database, optionally filtered by plan_id."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if plan_id:
            cur.execute("""
                SELECT id,
                       plan_id as "planId",
                       cpt_code as "cptCode",
                       procedure_name as "procedureName",
                       max_cost as "maxCost",
                       coverage_percentage as "coveragePercentage"
                FROM procedures
                WHERE plan_id = %s
                ORDER BY procedure_name
            """, (plan_id,))
        else:
            cur.execute("""
                SELECT id,
                       plan_id as "planId",
                       cpt_code as "cptCode",
                       procedure_name as "procedureName",
                       max_cost as "maxCost",
                       coverage_percentage as "coveragePercentage"
                FROM procedures
                ORDER BY procedure_name
            """)
        
        procedures = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(row) for row in procedures]
    except Exception as e:
        logger.error(f"Error fetching procedures: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching procedures"
        )


@router.get("/data/documents-required")
async def get_documents_required(plan_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get required documents from the database, optionally filtered by plan_id."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if plan_id:
            cur.execute("""
                SELECT id,
                       plan_id as "planId",
                       document_name as "documentName",
                       true as "isRequired"
                FROM documents_required
                WHERE plan_id = %s
                ORDER BY document_name
            """, (plan_id,))
        else:
            cur.execute("""
                SELECT id,
                       plan_id as "planId",
                       document_name as "documentName",
                       true as "isRequired"
                FROM documents_required
                ORDER BY document_name
            """)
        
        documents = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(row) for row in documents]
    except Exception as e:
        logger.error(f"Error fetching documents: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching documents"
        )


@router.get("/data/icd-codes")
async def get_icd_codes(search: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get ICD-10 codes from the mapping table."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if search:
            cur.execute("""
                SELECT DISTINCT icd_code as "icdCode",
                       diagnosis as "diagnosis"
                FROM mapping
                WHERE icd_code ILIKE %s OR diagnosis ILIKE %s
                ORDER BY icd_code
                LIMIT 20
            """, (f"%{search}%", f"%{search}%"))
        else:
            cur.execute("""
                SELECT DISTINCT icd_code as "icdCode",
                       diagnosis as "diagnosis"
                FROM mapping
                ORDER BY icd_code
                LIMIT 50
            """)
        
        codes = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(row) for row in codes]
    except Exception as e:
        logger.error(f"Error fetching ICD codes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching ICD codes"
        )


@router.get("/data/cpt-codes")
async def get_cpt_codes(search: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get CPT codes from the procedures/mapping table."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if search:
            cur.execute("""
                SELECT DISTINCT cpt_code as "cptCode",
                       procedure_name as "procedureName"
                FROM procedures
                WHERE cpt_code ILIKE %s OR procedure_name ILIKE %s
                ORDER BY cpt_code
                LIMIT 20
            """, (f"%{search}%", f"%{search}%"))
        else:
            cur.execute("""
                SELECT DISTINCT cpt_code as "cptCode",
                       procedure_name as "procedureName"
                FROM procedures
                ORDER BY cpt_code
                LIMIT 50
            """)
        
        codes = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(row) for row in codes]
    except Exception as e:
        logger.error(f"Error fetching CPT codes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching CPT codes"
        )


@router.get("/data/provider-plans")
async def get_provider_plans(current_user: User = Depends(get_current_user)):
    """
    Get plans for the currently logged-in provider from user_policies table.
    This endpoint returns only the plans that the provider has in their policy records.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get the current user's name from the users table
        cur.execute("""
            SELECT name FROM users WHERE id = %s AND role = 'PROVIDER'
        """, (int(current_user.id),))
        
        user_result = cur.fetchone()
        if not user_result:
            cur.close()
            conn.close()
            return []
        
        user_name = user_result['name']
        
        # Query user_policies for the provider and join with plans table
        cur.execute("""
            SELECT DISTINCT 
                   p.plan_id as id,
                   p.payer_id as "payerId",
                   p.plan_name as name,
                   p.plan_id as "planCode",
                   'PPO' as "planType",
                   true as "isActive"
            FROM user_policies up
            INNER JOIN plans p ON up.plan_id = p.plan_id
            WHERE up.user_name = %s
            ORDER BY p.plan_name
        """, (user_name,))
        
        plans = cur.fetchall()
        cur.close()
        conn.close()
        
        return [dict(row) for row in plans]
    except Exception as e:
        logger.error(f"Error fetching provider plans: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching provider plans"
        )


@router.get("/data/plan-details")
async def get_plan_details(plan_id: str, current_user: User = Depends(get_current_user)):
    """Get plan metadata for a single plan."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            """
            SELECT plan_id as id,
                   payer_id as "payerId",
                   plan_name as name,
                   plan_id as "planCode",
                   coverage_limit as "coverageLimit",
                   waiting_period_days as "waitingPeriodDays",
                   max_claims_per_year as "maxClaimsPerYear",
                   'PPO' as "planType",
                   true as "isActive"
            FROM plans
            WHERE plan_id = %s
            """,
            (plan_id,)
        )

        plan = cur.fetchone()
        cur.close()
        conn.close()

        return dict(plan) if plan else None
    except Exception as e:
        logger.error(f"Error fetching plan details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching plan details"
        )


@router.get("/data/waiting-periods")
async def get_waiting_periods(plan_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get waiting-period rules for a plan."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        if plan_id:
            cur.execute(
                """
                SELECT id,
                       plan_id as "planId",
                       disease_name as "diseaseName",
                       waiting_days as "waitingDays"
                FROM waiting_periods
                WHERE plan_id = %s
                ORDER BY disease_name
                """,
                (plan_id,)
            )
        else:
            cur.execute(
                """
                SELECT id,
                       plan_id as "planId",
                       disease_name as "diseaseName",
                       waiting_days as "waitingDays"
                FROM waiting_periods
                ORDER BY disease_name
                """
            )

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching waiting periods: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching waiting periods"
        )


@router.get("/data/excluded-procedures")
async def get_excluded_procedures(plan_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get excluded procedures for a plan."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        if plan_id:
            cur.execute(
                """
                SELECT id,
                       plan_id as "planId",
                       procedure_name as "procedureName",
                       plan_name as "planName",
                       category,
                       reason
                FROM excluded_procedures
                WHERE plan_id = %s
                ORDER BY procedure_name
                """,
                (plan_id,)
            )
        else:
            cur.execute(
                """
                SELECT id,
                       plan_id as "planId",
                       procedure_name as "procedureName",
                       plan_name as "planName",
                       category,
                       reason
                FROM excluded_procedures
                ORDER BY procedure_name
                """
            )

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching excluded procedures: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching excluded procedures"
        )


@router.get("/data/step-therapy")
async def get_step_therapy(plan_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get step-therapy rules for a plan."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        if plan_id:
            cur.execute(
                """
                SELECT id,
                       plan_id as "planId",
                       procedure_name as "procedureName",
                       required_prior as "requiredPrior",
                       plan_name as "planName"
                FROM step_therapy
                WHERE plan_id = %s
                ORDER BY procedure_name
                """,
                (plan_id,)
            )
        else:
            cur.execute(
                """
                SELECT id,
                       plan_id as "planId",
                       procedure_name as "procedureName",
                       required_prior as "requiredPrior",
                       plan_name as "planName"
                FROM step_therapy
                ORDER BY procedure_name
                """
            )

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching step therapy rules: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching step therapy rules"
        )


@router.get("/data/hospitals")
async def get_hospitals(payer_id: Optional[str] = None, search: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get network hospitals from the database."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            SELECT id,
                   payer_id as "payerId",
                   name,
                   city,
                   state,
                   pincode
            FROM hospitals
            WHERE 1 = 1
        """
        params: list[Any] = []

        if payer_id:
            query += " AND LOWER(payer_id) = LOWER(%s)"
            params.append(payer_id)
        if search:
            query += " AND (name ILIKE %s OR city ILIKE %s OR state ILIKE %s)"
            like = f"%{search}%"
            params.extend([like, like, like])

        query += " ORDER BY name LIMIT 100"
        cur.execute(query, tuple(params))

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching hospitals: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching hospitals"
        )


@router.get("/data/claims-history")
async def get_claims_history(patient_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get claim history rows from the database."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        if patient_id:
            cur.execute(
                """
                SELECT id,
                       patient_id as "patientId",
                       diagnosis,
                       procedure_name as "procedureName",
                       claim_date as "claimDate",
                       cost,
                       hospital_name as "hospitalName"
                FROM claims_history
                WHERE patient_id = %s
                ORDER BY claim_date DESC
                LIMIT 200
                """,
                (patient_id,)
            )
        else:
            cur.execute(
                """
                SELECT id,
                       patient_id as "patientId",
                       diagnosis,
                       procedure_name as "procedureName",
                       claim_date as "claimDate",
                       cost,
                       hospital_name as "hospitalName"
                FROM claims_history
                ORDER BY claim_date DESC
                LIMIT 200
                """
            )

        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching claims history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching claims history"
        )
