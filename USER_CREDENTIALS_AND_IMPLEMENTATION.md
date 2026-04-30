USER CREDENTIALS FOR AEGIS CLAIM SYSTEM
=========================================

This file contains the auto-generated credentials for all users in the system.
These credentials were generated and stored in the PostgreSQL database.

DATABASE: Neon PostgreSQL (ep-flat-dew-ancpuyq8-pooler.c-6.us-east-1.aws.neon.tech/neondb)
TABLE: users

===== USER CREDENTIALS =====

1. PROVIDER (Dr. Sarah Johnson)
   Email/Username: provider@example.com
   Password: -9EJf8GcDXvNSWci
   Role: PROVIDER
   Organization: Metro Health Clinic
   Use Case: Submit Prior Authorization requests

2. ADJUDICATOR (Michael Chen)
   Email/Username: adjudicator@example.com
   Password: FVrRKXbBe6CaYSut
   Role: ADJUDICATOR
   Organization: AegisClaim Review
   Use Case: Review and process PA submissions

3. ADMIN (Admin User)
   Email/Username: admin@example.com
   Password: thLe28w98LW2p0j7
   Role: ADMIN
   Organization: AegisClaim Admin
   Use Case: System administration and configuration

4. MEDICAL DIRECTOR (Dr. Emily Roberts)
   Email/Username: director@example.com
   Password: KsE8ZZ_WGZqV85Wf
   Role: MEDICAL_DIRECTOR
   Organization: AegisClaim Medical
   Use Case: Medical review and appeals decisions

========================

IMPLEMENTATION SUMMARY
========================

The following features have been implemented to display dynamic data from the database:

DATABASE CHANGES:
- Created "users" table in Neon PostgreSQL with:
  * user_id (unique identifier)
  * email (username for login)
  * name (display name)
  * password_hash (encrypted passwords)
  * role (PROVIDER, ADJUDICATOR, ADMIN, MEDICAL_DIRECTOR)
  * organization (affiliated organization)
  * is_active (status flag)
  * created_at / updated_at (timestamps)

BACKEND API ENDPOINTS (NEW):
- GET /api/v1/data/users
  Returns: All active users from the database

- GET /api/v1/data/payers
  Returns: All payers extracted from plans table

- GET /api/v1/data/plans?payer_id=<payer_id>
  Returns: Plans filtered by payer ID

- GET /api/v1/data/procedures?plan_id=<plan_id> (optional)
  Returns: Procedures/CPT codes, optionally filtered by plan

- GET /api/v1/data/documents-required?plan_id=<plan_id> (optional)
  Returns: Required documents, optionally filtered by plan

- GET /api/v1/data/icd-codes?search=<search_term> (optional)
  Returns: ICD-10 codes with optional search filtering

- GET /api/v1/data/cpt-codes?search=<search_term> (optional)
  Returns: CPT codes with optional search filtering

FRONTEND SERVICE UPDATES (pa.service.ts):
- getAllUsers()
- getAllPayers()
- getPlansByPayerId(payerId)
- getProcedures(planId?)
- getDocumentsRequired(planId?)
- getICDCodes(search?)
- getCPTCodes(search?)

FRONTEND HOOKS (usePA.ts):
- useUsers() - Fetch all users
- useAllPayers() - Fetch all payers from database
- usePlansByPayerDB(payerId) - Fetch plans for a payer
- useProcedures(planId?) - Fetch procedures
- useDocumentsRequired(planId?) - Fetch required documents
- useICDCodes(search?) - Fetch ICD codes with search
- useCPTCodes(search?) - Fetch CPT codes with search

DATABASE REFERENCE DATA:
The following data is already populated in the Neon database and will be displayed
dynamically in the UI:

1. Insurance Plans (3 records)
   - HDFC_001: HDFC Ergo Optima Secure
   - ICICI_001: ICICI Lombard Health Cover
   - Plan 3: Additional coverage

2. Procedures/CPT Codes (34 records)
   - 71020: X-Ray ($5,000, 80% coverage)
   - 71250: CT Scan
   - And 32 more procedure codes

3. Required Documents (9 records)
   - Prescription
   - Lab reports
   - Clinical justification
   - Etc.

4. Waiting Periods (60 records)
   - General: 30 days
   - Diabetes: 1095 days
   - And more condition-specific waiting periods

5. Excluded Procedures (15 records)
   - Cosmetic surgery
   - Bariatric surgery
   - Etc.

6. User Policies (20 records)
   - Active insurance policies for beneficiaries
   - Coverage amounts and usage tracking

NEXT STEPS TO USE:
1. Start the backend: python -m uvicorn api.main:app --reload
2. Start the frontend: npm run dev
3. Login with any of the credentials above
4. The forms will now display dynamic data from the database instead of mock data

========================
