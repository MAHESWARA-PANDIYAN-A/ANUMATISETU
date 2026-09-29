# Smart India Hackathon (SIH 2026) - Project Audit Report
## Problem Statement ID: SIH26130
### "Efficiency in streamlining industrial approvals, compliance processes, and access to government support services"
**Target Roles:** 1. Entrepreneur / Applicant | 2. Government Officer

---

## Executive Summary
A comprehensive physical inspection and technical audit of the project workspace (`d:\SIH\SIH 2`) was conducted on **September 24, 2026**. 

The repository is currently a **greenfield (pristine/blank slate) workspace** with 0 active files and no version control initialized. This provides an optimal foundation to architect an enterprise-grade, high-performance, single-window clearance and compliance orchestration system tailored to **SIH26130** (sponsored by the Government of Maharashtra / MSIS) without legacy technical debt or architectural compromises.

---

## 1. Repository Inspection & Baseline Inventory

| Audit Item | Current Status | Audit Finding & Technical Detail |
| :--- | :--- | :--- |
| **Physical Workspace** | Empty | `d:\SIH\SIH 2` contains 0 files and 0 subdirectories. |
| **Git / Version Control** | Not Initialized | No `.git` directory, git history, remotes, or tracking branches found. |
| **Frontend Framework** | Uninitialized | No frontend scaffolding (React/Next.js/Vite) currently present. |
| **Backend Framework** | Uninitialized | No backend scaffolding (FastAPI/Node.js/Express) currently present. |
| **Database & ORM** | None | No active database engine, migration files, or ORM schemas (Prisma/SQLAlchemy) configured. |
| **Authentication System** | None | No JWT, OAuth2, session management, or Role-Based Access Control (RBAC) implemented. |
| **API Routes** | None | 0 endpoints defined. |
| **Components & Pages** | None | 0 UI components or pages created. |
| **Environment Variables** | Missing | No `.env` or `.env.example` file found in the workspace root. |
| **File Storage / Upload** | None | No S3/MinIO/Cloudinary or local multipart storage configured. |
| **AI / ML Integrations** | None | No LLM/OCR pipeline, regulatory vector store, or heuristic rules engine integrated. |
| **Hard-coded / Mock Data** | None | No mock JSON or fixture datasets present in the workspace. |
| **Incomplete / Broken Code**| N/A | Greenfield project; no existing bugs, lint errors, or broken dependencies. |
| **Duplicate / Dead Code** | None | Clean baseline with zero legacy bloat. |

---

## 2. Current vs. Target Architecture

### 2.1 Current Architecture: Greenfield Blank Slate
* **State:** Uninitialized directory.
* **Limitation:** Lacks all core components, application logic, and data layer.

### 2.2 Target Architecture: Dual-Role Compliance Orchestration Platform
To win SIH26130, the system must be structured around a **Single-Window Clearance & Regulatory Intelligence Engine** featuring asynchronous workflow orchestration and strict Role-Based Access Control (RBAC).

```mermaid
graph TD
    subgraph ClientLayer ["Client Layer (Modern UI / PWA)"]
        UI_E["Entrepreneur / Applicant Portal\n- KYA Wizard & Smart Checklist\n- Unified Common Application Form (CAF)\n- Document Locker & Reusability Vault\n- Real-time SLA & Deemed Approval Tracker\n- Support Schemes & Subsidies Matcher"]
        UI_G["Government Officer Portal\n- Scrutiny & Verification Desk\n- Multi-Department Workflow Engine\n- Digital Sign-off & NOC Dispatch\n- Query & Deficiency Raising\n- District / State Analytics Dashboard"]
    end

    subgraph GatewayAuth ["API Gateway & Security Layer"]
        GW["Reverse Proxy / API Gateway (FastAPI / Next.js API)"]
        AUTH["RBAC & Identity Provider (JWT, OAuth2, Digilocker/e-KYC Mock)"]
    end

    subgraph ServiceLayer ["Core Service Orchestration Layer"]
        KYA["KYA Recommendation Engine\n(Sector, Scale, Zone, Risk Classification)"]
        WORKFLOW["Compliance Workflow Engine\n(DAG Dependency Tracker, SLA, Escalations)"]
        DOCS["Document Vault & Verification\n(Metadata Extraction, OCR, Reusability)"]
        SCHEMES["Government Support & Subsidy Engine\n(Incentive Matching, Capital Subsidies, PSI)"]
        AI_AGENT["AI Compliance Copilot\n(Regulatory RAG, Query Defect Detector)"]
    end

    subgraph DataLayer ["Data & Storage Layer"]
        DB[(PostgreSQL / SQLite with SQLAlchemy/Prisma)]
        VAULT[(Object Storage: S3 / MinIO / Local Secure Storage)]
        REDIS[(Redis Cache / Celery for Reminders & SLA Timers)]
    end

    UI_E --> GW
    UI_G --> GW
    GW --> AUTH
    GW --> KYA
    GW --> WORKFLOW
    GW --> DOCS
    GW --> SCHEMES
    GW --> AI_AGENT

    KYA --> DB
    WORKFLOW --> DB
    WORKFLOW --> REDIS
    DOCS --> VAULT
    DOCS --> DB
    SCHEMES --> DB
    AI_AGENT --> DB
```

---

## 3. Feature Matrix: Current Status vs. SIH26130 Requirements

### 3.1 Completed Features
* **None (0%)**: Greenfield state.

### 3.2 Partially Implemented Features
* **None (0%)**: No partial implementations detected.

### 3.3 Broken Features
* **None (0%)**: Clean slate, zero technical debt.

### 3.4 Missing Features Required for SIH26130

#### Role 1: Entrepreneur / Industrial Applicant
1. **Interactive "Know Your Approvals" (KYA) Smart Wizard:**
   - Dynamic questionnaire assessing industry type (Manufacturing, IT, Chemical, Food Processing, etc.), scale (Micro, Small, Medium, Large via MSME criteria), investment brackets, proposed land zone (MIDC Industrial Zone, Non-MIDC, Non-Agricultural/Agricultural), labor strength, power/water requirements, and hazardous emissions.
   - Instant generation of mandatory permits, clearances, and NOCs categorized by pre-establishment (CTE, Land, CFO) and pre-operation (CTO, Factory License, Labor).
2. **Unified Common Application Form (CAF):**
   - Single-entry form populating standard master data (enterprise legal name, PAN, GSTIN, promoter details, authorized signatory, site coordinates).
   - Eliminates redundant multi-department data entry.
3. **Digital Document Vault & Single-Upload Locker:**
   - Central repository for enterprise identity documents (PAN, Aadhaar, MOA/AOA, Land Title/Deed, DPR, Site Layout, Machinery Specs).
   - Auto-attachment of verified documents to relevant departmental applications.
4. **Visual Compliance Tracker & Critical Path DAG:**
   - Live stage-by-stage Gantt/flow visualization showing prerequisite dependencies (e.g. Building Plan approval required prior to CFO NOC; CFO NOC required prior to Factory License).
   - Statutory SLA countdown timer for each clearance with "Deemed Approval" alerts.
5. **Government Support Services & Subsidy Recommender:**
   - Personalized discovery of Maharashtra & Central Government incentive schemes (e.g., Package Scheme of Incentives [PSI], Interest Subvention, Electricity Duty Exemption, Capital Subsidy, Stamp Duty Waiver, Green Energy Incentives).
   - Eligibility calculator and one-click application linking.
6. **Deficiency / Query Redressal System:**
   - Real-time notification and interactive resolution console when an officer raises an objection or requests supplementary documentation, preventing indefinite application stagnation.
7. **AI Regulatory Copilot & Instant Helpdesk:**
   - Context-aware chatbot trained on industrial policies, environmental acts (Air/Water Act), Factory Act rules, and building bylaws to guide first-time entrepreneurs.

#### Role 2: Government Officer / Departmental Approver
1. **Single-Pane Officer Scrutiny Desk:**
   - Role-segmented queues (e.g., MPCB Officer, Fire Officer/CFO, Factory Inspector, Town Planning Officer, District Collectorate).
   - Scrutiny checklist with side-by-side document preview and validation controls.
2. **Query Raising & Timed Objection Workflow:**
   - Standardized defect categorization with automated notices sent directly to the applicant's dashboard and SMS/email.
   - Statutory query resolution timer.
3. **Digital Endorsement & Tamper-Proof Clearance Issuance:**
   - Workflow to approve, reject with reasoned order, or grant conditional approvals.
   - Automated digital certificate / NOC generation with verifiable QR code and unique reference ID.
4. **Joint Inspection Scheduler:**
   - Coordination tool for inter-departmental site visits (MPCB, DISH, Fire) to avoid repeated separate inspections and minimize entrepreneur disruption.
5. **SLA Monitoring & Auto-Escalation Engine:**
   - Real-time heatmaps highlighting delayed applications approaching statutory limits.
   - Automated escalation notifications to higher departmental heads (e.g., Joint Director / Principal Secretary).
6. **Administrative & District Investment Analytics:**
   - Executive dashboard tracking total applications processed, average turnaround time (TAT), bottleneck departments, rejected vs. approved rates, and expected capital investment inflows.

---

## 4. Hard-Coded Data & Rules Engine Requirements

### Current Status
* No hard-coded data present in the repository.

### Requirements & Anti-Pattern Mitigation
To prevent brittle hackathon prototypes, the system must separate application logic from regulatory matrices:
* **Department & Clearance Registry:** Dynamically seed 10+ standard approvals across:
  - **MPCB:** Consent to Establish (CTE), Consent to Operate (CTO) (Red/Orange/Green/White categorized).
  - **Fire Services (CFO):** Provisional Fire NOC, Final Fire NOC.
  - **DISH (Factories Directorate):** Factory Plan Approval, Factory License.
  - **MIDC / Town Planning:** Land Allotment, Building Plan Approval, Plinth Clearance, Occupancy Certificate.
  - **MSEDCL:** HT/LT Power Sanction Feasibility.
  - **Labour Department:** Registration under Shops & Commercial Establishments, Contract Labour Act.
* **Government Support Services Catalog:** Dynamically seed real state incentive policies:
  - Maharashtra Package Scheme of Incentives (PSI).
  - Credit Linked Capital Subsidy Scheme (CLCSS).
  - Prime Minister's Employment Generation Programme (PMEGP).
  - Technology Upgradation Fund Scheme.
* **Avoidance of Fake Mocks:** All data must be persisted in a database, allowing live demonstration of form submission, officer scrutiny, query raising, and real-time state updates across two different browser sessions.

---

## 5. Required Environment Variables

When initializing the application, the following configuration parameters must be established in `.env`:

```ini
# Application Configuration
NODE_ENV=development
PORT=3000
API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME="MAITRI-Next: Single-Window Industrial Clearance & Compliance Platform"

# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sih_industrial_db"
# Fallback / Dev SQLite: "file:./dev.db"

# Authentication & Security
JWT_SECRET=super_secret_jwt_key_sih2026_industrial_approvals_32char
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=32_byte_aes_key_for_sensitive_applicant_pii_data

# Storage Provider (Local or Cloud)
STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=./uploads
MAX_FILE_SIZE_MB=15

# AI / LLM Integrations (Optional / Extended Copilot)
GEMINI_API_KEY=your_gemini_api_key_here
# or GROQ_API_KEY=...

# Notification Services (Mockable for local hackathon demo)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=mock_user
SMTP_PASS=mock_pass
ENABLE_NOTIFICATION_DISPATCH=false
```

---

## 6. Database Status & Target Schema Design

### Current Status
* **Absent**: No database client, schema definitions, or seed scripts exist.

### Recommended Target Relational Schema (PostgreSQL / SQLite via ORM)

```mermaid
erDiagram
    USERS ||--o{ APPLICATIONS : "submits"
    USERS ||--o{ OFFICER_ACTIONS : "performs"
    USERS ||--o{ AUDIT_LOGS : "triggers"
    
    ENTERPRISE ||--o{ APPLICATIONS : "files"
    ENTERPRISE ||--o{ DOCUMENTS : "owns"
    
    APPLICATIONS ||--o{ APPLICATION_CLEARANCES : "requires"
    APPLICATIONS ||--o{ APPLICATION_DOCUMENTS : "contains"
    APPLICATIONS ||--o{ QUERIES : "has"
    
    DEPARTMENTS ||--o{ CLEARANCE_DEFINITIONS : "administers"
    CLEARANCE_DEFINITIONS ||--o{ APPLICATION_CLEARANCES : "instantiates"
    
    APPLICATION_CLEARANCES ||--o{ OFFICER_ACTIONS : "reviewed_in"
    APPLICATION_CLEARANCES ||--o{ QUERIES : "raises"
    APPLICATION_CLEARANCES ||--o{ INSPECTIONS : "scheduled_for"
    
    SCHEMES ||--o{ SCHEME_APPLICATIONS : "applied_for"
    ENTERPRISE ||--o{ SCHEME_APPLICATIONS : "benefits"
```

#### Core Entities:
1. **`User`**: `id`, `email`, `passwordHash`, `fullName`, `phone`, `role` (`ENTREPRENEUR` | `OFFICER` | `ADMIN`), `departmentId` (nullable, for officers), `createdAt`.
2. **`Enterprise`**: `id`, `userId`, `companyName`, `pan`, `gstin`, `udyamNo`, `category` (MICRO/SMALL/MEDIUM/LARGE), `sector` (CHEMICAL, TEXTILE, IT, FOOD, PHARMA, etc.), `district`, `taluka`, `zoneType`, `capitalInvestment`, `expectedLabor`.
3. **`ClearanceDefinition`**: `id`, `code` (e.g., `MPCB_CTE`, `CFO_FIRE_NOC`), `departmentId`, `title`, `description`, `statutorySlaDays`, `riskLevel`, `stage` (PRE_ESTABLISHMENT / PRE_OPERATION), `feeAmount`, `requiredDocTypes`.
4. **`Application`**: `id`, `applicationNo`, `enterpriseId`, `status` (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `QUERY_RAISED`, `APPROVED`, `REJECTED`), `submissionDate`, `overallSlaDeadline`.
5. **`ApplicationClearance`**: `id`, `applicationId`, `clearanceId`, `status` (`PENDING_PREREQUISITE`, `SUBMITTED`, `IN_SCRUTINY`, `INSPECTION_SCHEDULED`, `APPROVED`, `REJECTED`), `assignedOfficerId`, `approvedAt`, `slaDueDate`, `certificateUrl`, `qrCodeHash`.
6. **`Document`**: `id`, `enterpriseId`, `docType` (PAN, AADHAAR, LAND_DEED, DPR, SITE_PLAN, EIA_REPORT), `fileName`, `fileUrl`, `fileSize`, `uploadedAt`, `verifiedStatus`.
7. **`Query`**: `id`, `applicationClearanceId`, `officerId`, `subject`, `description`, `status` (`OPEN`, `RESOLVED`), `responseComment`, `resolvedAt`.
8. **`Inspection`**: `id`, `applicationId`, `inspectionDate`, `officersInvolved`, `findings`, `status` (`SCHEDULED`, `COMPLETED`, `WAIVED`).
9. **`Scheme`**: `id`, `name`, `department`, `subsidyType`, `maxBenefitAmount`, `eligibilityCriteriaJson`, `description`.
10. **`AuditLog`**: `id`, `userId`, `action`, `resourceType`, `resourceId`, `timestamp`, `ipAddress`, `metadata`.

---

## 7. API Specification Matrix

### Current Status
* **Absent**: 0 endpoints exist.

### Target RESTful API Design

| Module | Method | Endpoint | Access Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Public | Entrepreneur / Officer registration |
| **Auth** | `POST` | `/api/auth/login` | Public | Credentials validation & JWT issuance |
| **Auth** | `GET` | `/api/auth/me` | Authenticated | Current session & profile |
| **KYA Engine** | `POST` | `/api/kya/evaluate` | Public/Auth | Compute required NOCs & statutory roadmap |
| **Enterprise**| `GET/POST`| `/api/enterprise/profile` | Entrepreneur | Create/update enterprise master details |
| **Applications**| `GET` | `/api/applications` | Both (Scoped)| List applications (Applicant's own or Officer's dept) |
| **Applications**| `POST` | `/api/applications` | Entrepreneur | Submit new Common Application Form (CAF) |
| **Applications**| `GET` | `/api/applications/:id` | Both | Detailed application breakdown & DAG timeline |
| **Documents** | `POST` | `/api/documents/upload` | Entrepreneur | Upload file to secure vault with auto-categorization |
| **Documents** | `GET` | `/api/documents` | Entrepreneur | Fetch document vault items for reusability |
| **Officer** | `POST` | `/api/officer/scrutiny` | Officer | Update clearance status (Approve / Reject) |
| **Officer** | `POST` | `/api/officer/queries` | Officer | Raise deficiency/clarification query |
| **Applicant** | `POST` | `/api/queries/:id/resolve` | Entrepreneur | Respond to deficiency with clarifications/files |
| **Inspections**| `POST` | `/api/inspections/schedule` | Officer | Schedule single/joint department inspection |
| **Schemes** | `GET` | `/api/schemes/recommend`| Both | Get matched incentives based on enterprise profile |
| **Analytics** | `GET` | `/api/analytics/dashboard`| Officer/Admin| Macro clearance turnaround, bottleneck detection |
| **AI Copilot** | `POST` | `/api/ai/chat` | Authenticated | Compliance query assistant & document checklist OCR |

---

## 8. Security, Integrity & Compliance Audit

To ensure the solution adheres to government-grade security standards and hackathon judging evaluation:

1. **Role-Based Access Control (RBAC):**
   - Critical vulnerability to avoid: IDOR (Insecure Direct Object Reference). Officers must only access applications routed to their department or jurisdiction; applicants must never view or edit another business's confidential DPR or legal papers.
2. **Tamper-Proof Audit Trail:**
   - Every status shift, query raised, scrutiny sign-off, or document download must be timestamped with user ID, department code, and client IP in an immutable `AuditLog` table.
3. **Verification & Authenticity (QR / Digital Signature):**
   - Issued NOCs and clearance certificates must generate a cryptographically verifiable SHA256 digest rendered as a dynamic QR code for third-party validation (e.g. banks, municipal inspectors).
4. **Data Privacy & Document Protection:**
   - Uploaded industrial files (such as secret intellectual property, plant schematics, and financial audit reports) must be served via authenticated signed URLs or secure backend proxy streaming rather than publicly accessible static folders.
5. **Anti-Corruption & Deemed Approval Safeguards:**
   - System clock enforcement on statutory SLA countdowns. If an officer fails to review an application within the state-mandated window (e.g. 30 days for Green Industry CTE), the system automatically flags the application for deemed approval or triggers an escalation alert to the Directorate.

---

## 9. Recommended Implementation Order (Roadmap)

To systematically build and polish this project into a winning SIH submission, the development workflow is structured into 6 sequential phases:

```mermaid
timeline
    title SIH26130 Phased Implementation Roadmap
    Phase 1 : Core Architecture & Tech Stack Scaffold : Database Modeling (Prisma/PostgreSQL) : Authentication & RBAC Engine
    Phase 2 : Master Data & KYA Rule Engine : Dynamic Sector/Risk Decision Tree : Common Application Form (CAF)
    Phase 3 : Document Vault & Multi-File Storage : Reusable Document Locker : Validation & OCR Mocking
    Phase 4 : Dual-Role Dashboards : Entrepreneur Cockpit & SLA Tracker : Officer Scrutiny Console & Query Engine
    Phase 5 : Compliance Workflow & Inspection Scheduler : Prerequisite Dependency DAG : Joint Inspection Booking : QR Certificate Generator
    Phase 6 : Government Support Services & Analytics : Incentive & Subsidy Matcher : Macro State Analytics Dashboard : AI Copilot & Polish
```

### Detailed Phase Milestones:
1. **Phase 1: Foundation & RBAC Scaffolding**
   - Initialize unified modern stack (Next.js with App Router / TypeScript / Tailwind CSS or Vite + FastAPI).
   - Set up Database schemas (User, Enterprise, Application, Clearance, Document, Query, AuditLog).
   - Implement role-based authentication with dual-role pre-seeded demo accounts (e.g., `applicant@industry.com` and `officer.mpcb@gov.in`).
2. **Phase 2: "Know Your Approvals" (KYA) Engine & Common Application Form**
   - Develop intelligent multi-step KYA questionnaire evaluating sector, scale, hazardous categorizations, and zoning.
   - Build master Common Application Form (CAF) capturing consolidated enterprise data once.
3. **Phase 3: Secure Document Vault & Verification**
   - Create reusable Document Locker with preview capabilities.
   - Implement document attachment engine linking vault files to specific NOC applications.
4. **Phase 4: Dual-Role Operational Dashboards**
   - **Entrepreneur UI:** Active applications, real-time SLA progress rings, visual timeline, deficiency notifications.
   - **Officer UI:** Scrutiny inbox, split-view document evaluation, one-click query raiser, approval/rejection modal with reasoned remarks.
5. **Phase 5: Compliance Orchestration & NOC Issuance**
   - Enforce dependency DAG rules (blocking downstream applications until upstream clearances are issued).
   - Joint inspection scheduler across departments.
   - Automated NOC certificate generator with dynamic QR validation.
6. **Phase 6: Government Support Services, State Analytics & AI Copilot**
   - Scheme discovery engine matching enterprises to subsidies (Maharashtra PSI, capital subsidies).
   - District-level analytics dashboard visualizing approval times, bottlenecks, and total proposed investments.
   - AI Regulatory Copilot for query resolution and intelligent compliance suggestions.

---

## Conclusion
The audit of `d:\SIH\SIH 2` confirms an ideal clean-slate project baseline. By following the targeted dual-role architecture and structured implementation roadmap detailed above, the resulting platform will directly solve problem statement **SIH26130**, delivering measurable efficiency, transparency, and high hackathon impact.
