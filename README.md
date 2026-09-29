# TASKER — Industrial Approval & Compliance Platform

> **Subtitle:** AI-Powered Single-Window Industrial Approval & Statutory Compliance Coordination Platform  
> **Problem Statement ID:** SIH26130

---

## 1. Overview & Storage Architecture

TASKER is an end-to-end industrial clearance platform designed for entrepreneurs and industrial applicants across India. It consolidates statutory approvals (FSSAI, GST, Udyam MSME, Trademark Registry, State Pollution Control Boards) into a unified experience.

### Decoupled Storage Architecture

TASKER uses a **zero-binary database architecture**:
- **PostgreSQL Database**: Stores document metadata, user/business ownership, version history, automated validation results, cross-portal usage relationships, and Cloudinary external asset identifiers. Binary file blobs are **never** stored in PostgreSQL.
- **Cloudinary Storage**: Stores actual file binaries (PDF, JPG, JPEG, PNG) under **restricted/authenticated asset delivery**. Unrestricted public URLs are disabled.

```
                    ┌─────────────────────────────────┐
                    │         TASKER React UI         │
                    └────────────────┬────────────────┘
                                     │ (Multipart Upload / JWT Auth)
                                     ▼
                    ┌─────────────────────────────────┐
                    │      TASKER FastAPI Backend     │
                    │       (DocumentService)         │
                    └───────┬─────────────────┬───────┘
                            │                 │
              (Metadata & Relations)    (Encrypted Binary / Signed URLs)
                            ▼                 ▼
             ┌─────────────────────────┐  ┌─────────────────────────┐
             │   PostgreSQL Database   │  │    Cloudinary Vault     │
             ├─────────────────────────┤  ├─────────────────────────┤
             │ • document ownership    │  │ • PDF Documents         │
             │ • document types        │  │ • JPG / JPEG / PNG      │
             │ • version history (1..N)│  │ • Authenticated Delivery│
             │ • SHA-256 duplicate hash│  │ • Time-limited Signed   │
             │ • validation status     │  │   URLs (15 min)         │
             │ • application mappings  │  │ • Zero Public Access    │
             │ • Cloudinary identifiers│  │                         │
             └─────────────────────────┘  └─────────────────────────┘
```

---

## 2. Core Document Capabilities

1. **Upload Once, Reuse Everywhere**:
   - Applicant uploads compliance documents (e.g., PAN Card, Incorporation Certificate, Address Proof, Passport Photo) into the central Document Center.
   - When submitting unified applications to multiple statutory bodies (FSSAI, GST, Udyam, Trademark), TASKER maps the existing document records without requiring duplicate uploads.
2. **SHA-256 Duplicate Detection**:
   - Prior to storage, every uploaded file's SHA-256 hash is calculated.
   - If an identical file already exists for the business profile, the user is alerted and offered to *Use Existing* or *Upload Anyway*.
3. **Historical Document Versioning**:
   - When replacing a document (e.g. Address Proof v1 → v2), historical versions are preserved with their own Cloudinary identifiers, timestamps, and audit records.
   - Submitted applications locked to historical versions (v1) remain linked without silent modification.
4. **Time-Limited Signed Delivery**:
   - Protected documents are served through short-lived signed URLs (`GET /api/documents/{id}/view` and `GET /api/documents/{id}/download`).
   - Unrestricted public URLs are never stored or exposed to clients.
5. **Pre-Validation & Profile Auto-Enrichment**:
   - In-memory OCR and text extraction parse registration identifiers (PAN, CIN, GSTIN) and validate format integrity.
   - Sensitive numbers are masked (`AA******1A`) in responses and audit logs.
6. **Deletion Protection**:
   - Documents referenced by active statutory applications cannot be destructively deleted; the platform guides the user to archive them safely.

---

## 3. Cloudinary Configuration & Environment Variables

### Backend `.env` (`backend/.env`)
```ini
# PostgreSQL Database
DATABASE_URL=postgresql://postgres:1234@localhost:5432/sih_industrial_db

# Security & JWT Authentication
JWT_SECRET=your_secure_jwt_secret_key_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Cloudinary Document Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=tasker/documents
CLOUDINARY_SECURE=true
CLOUDINARY_ASSET_TYPE=authenticated

# Document Constraints
MAX_DOCUMENT_SIZE_MB=5
ALLOWED_DOCUMENT_TYPES=pdf,jpg,jpeg,png

# AI Assistant & Grok Integration
GROQ_API_KEY=your_groq_or_xai_api_key
GROK_API_KEY=your_groq_or_xai_api_key
```

### Windows PowerShell Configuration
To set temporary environment variables in Windows PowerShell:
```powershell
$env:CLOUDINARY_CLOUD_NAME="your_cloud_name"
$env:CLOUDINARY_API_KEY="your_api_key"
$env:CLOUDINARY_API_SECRET="your_api_secret"
$env:CLOUDINARY_FOLDER="tasker/documents"
$env:CLOUDINARY_SECURE="true"
$env:CLOUDINARY_ASSET_TYPE="authenticated"
```

### Frontend `.env` (`frontend/.env`)
```ini
VITE_API_BASE_URL=http://localhost:8000
```

> [!IMPORTANT]
> **Cloudinary Security Policy:**
> - `CLOUDINARY_API_SECRET` is server-side only. It is **never** exposed to the frontend or sent in API payloads.
> - Never create or use `VITE_CLOUDINARY_API_SECRET`.
> - All document uploads pass from Frontend → TASKER FastAPI backend → Cloudinary.

---

## 4. API Endpoints

### Document Center & Vault (`/api/documents` & `/api/v1/documents`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/documents/upload` | Validates file, uploads to Cloudinary, creates PostgreSQL record & v1 version |
| `GET` | `/api/documents` | List user's documents with validation status & statutory application usage |
| `GET` | `/api/documents/{id}` | Retrieve document metadata (Cloudinary keys masked) |
| `GET` | `/api/documents/{id}/view` | Generates short-lived (15-min) signed Cloudinary viewing URL |
| `GET` | `/api/documents/{id}/download` | Generates short-lived signed attachment download URL |
| `POST` | `/api/documents/{id}/replace` | Uploads replacement file, increments version (v2, v3...), preserves history |
| `POST` | `/api/documents/{id}/validate` | Triggers OCR pre-validation and compliance check |
| `POST` | `/api/documents/{id}/archive` | Marks document as ARCHIVED; keeps file for legal audit trail |
| `DELETE`| `/api/documents/{id}` | Deletes document if not referenced by active applications |
| `GET` | `/api/documents/{id}/usage` | Returns list of statutory portals using the document (FSSAI, GST, Udyam) |
| `GET` | `/api/documents/{id}/versions` | Returns complete version history of the document |
| `GET` | `/api/documents/metrics` | Returns Document Center dashboard counts (Total, Ready, Reused, Archived) |
| `GET` | `/api/documents/missing` | Computes missing statutory documents for selected approval workflows |
| `POST` | `/api/applications/{id}/documents/reuse` | Links existing vault document to a statutory application requirement |

### Health Check (`/api/health`)
```json
{
  "status": "healthy",
  "database": "connected",
  "cloudinary": {
    "configured": true,
    "status": "connected",
    "cloud_name": "tasker-industrial"
  },
  "service": "ok",
  "timestamp": "2026-09-28T21:00:00Z"
}
```

---

## 5. Local File Migration Utility

If the platform previously stored documents on local disk, run the automated migration script:

```bash
cd backend
python migrate_local_to_cloudinary.py
```

Options:
- `--cleanup`: Safely deletes verified local files after successful Cloudinary upload and database confirmation.
- `--dry-run`: Scans local files and reports pending migrations without modifying storage.

---

## 6. Running the Platform Locally

### Backend Setup
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 7. Running Test Suites

### Cloudinary Document Vault Integration Test Suite
```powershell
cd backend
python test_cloudinary_integration.py
```
**Tests Covered:**
1. Cloudinary Storage Provider initialization & connectivity diagnostics
2. Document upload & PostgreSQL metadata persistence
3. SHA-256 duplicate document detection & rejection
4. Authenticated / signed time-limited view & download URL generation
5. Document version replacement & historical version preservation
6. Document archival & query scoping
7. Local-to-Cloudinary migration runner
8. Health check status verification
