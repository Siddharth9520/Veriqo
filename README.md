# Veriqo — Autonomous AI Quality Engineering Platform

> **Tagline**: Every Bug. Proven.  
> **Product Promise**: Ship with proof.

Veriqo is an autonomous AI quality engineering platform that explores web applications, executes typed browser test journeys, captures screenshot evidence, detects regressions, independently confirms defects using **BlindReplay**, computes deterministic QA scores, and issues cryptographic certificates of testing integrity.

---

## Architecture Overview

```text
VERIQO_VIT_Apex/
├── backend/                  # Python FastAPI Backend & Browser Automation Engine
│   ├── app/                  # Application source
│   │   ├── api/v1/           # REST endpoints (apps, runs, defects, certs, replays, specs)
│   │   ├── core/             # Configuration, security policies & loopback guards
│   │   ├── db/               # SQLite database session with WAL & foreign keys
│   │   ├── models/           # SQLAlchemy 2.0 ORM models
│   │   ├── schemas/          # Pydantic v2 schemas
│   │   └── services/         # Playwright runner, BlindReplay, Exploration & Spec Ingestion
│   ├── tests/                # 133 pytest automated unit and integration tests
│   ├── requirements.txt      # Pinned Python dependencies
│   ├── .env.example          # Safe environment variable template
│   └── veriqo.db             # Persistent SQLite database
├── frontend/                 # Next.js 16 (React 19, Turbopack) Dashboard & API Gateway
│   ├── app/                  # App Router pages & API Gateway Route Handlers
│   ├── components/           # Neo-Brutalist Stitch UI components
│   ├── lib/                  # Typed API clients & backend gateway bridge
│   ├── package.json          # Node dependencies & build scripts
│   └── .env.example          # Safe frontend configuration template
├── start-dev.ps1             # Windows PowerShell development launcher
├── AUDIT_REPORT.md           # Full-stack architectural audit and findings
├── IMPLEMENTATION_REPORT.md  # Detailed changes and implementation decisions
├── TEST_REPORT.md            # Complete test suite and benchmark metrics
├── FINAL_VERIFICATION_REPORT.md # Verification of all master acceptance criteria
├── DEMO_RUNBOOK.md           # Live hackathon presentation walkthrough
└── README.md                 # Primary project documentation
```

---

## Core Differentiators & Features

### 1. Bounded Autonomous Exploration
- Crawls registered target applications using Playwright without requiring pre-written scripts.
- Enforces depth and page bounds with strict origin restrictions.
- Avoids destructive actions (`/delete|buy|checkout/i`) and synthesizes typed regression journeys automatically.

### 2. BlindReplay (Independent Defect Reproduction)
- Launches an **isolated browser context** without original script selectors, DOM state, or cookies.
- Employs heuristic semantic element discovery to reproduce defects independently.
- Distinguishes `CONFIRMED`, `NOT_REPRODUCED`, `INCONCLUSIVE`, and `TIMED_OUT` outcomes truthfully.
- Defect status transitions to `VERIFIED` strictly when demonstrable reproduction succeeds.

### 3. Deterministic QA Scoring & Verifiable Certificates
- Computes reproducible quality scores from journey and assertion pass rates minus weighted defect penalties.
- Issues verifiable QA Certificates with canonical SHA-256 integrity digests.
- Dual-mode verification detects payload tampering immediately.

### 4. Show Me Mode & Fix Prompt Generation
- Structured failure diagnostics linking step logs, assertions, and screenshot evidence.
- Exports IDE-ready Markdown bug reports for developer AI assistants.

### 5. OpenAPI 3.x & HAR Spec Ingestion
- Ingests REST definitions and HAR network traces into candidate test journeys.
- Automatically scrubs sensitive credentials (`Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`).

---

## Prerequisites

- **Python**: `3.10` to `3.12` (Python 3.11 recommended)
- **Node.js**: `20.x` or `22.x` LTS
- **npm**: `9.x` or newer
- **PowerShell**: Windows PowerShell 5.1 or PowerShell 7+
- **Playwright Chromium**: Automatically installed via CLI

---

## Quick Start (Automated Windows Launcher)

Launch both the backend and frontend simultaneously with health polling:

```powershell
.\start-dev.ps1
```

Or open them in separate interactive PowerShell terminal windows:

```powershell
.\start-dev.ps1 -SeparateWindows
```

---

## Manual Setup & Installation

### 1. Backend Setup

```powershell
cd backend

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies and Playwright browser binaries
pip install -r requirements.txt
playwright install chromium chromium-headless-shell

# Configure environment
Copy-Item .env.example .env

# Start FastAPI backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Health Endpoint**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **Readiness Probe**: [http://127.0.0.1:8000/ready](http://127.0.0.1:8000/ready)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### 2. Frontend Setup

```powershell
cd frontend

# Install npm dependencies
npm install

# Configure environment
Copy-Item .env.example .env.local

# Start Next.js development server
npm run dev
```

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Command Center**: [http://localhost:3000/command-center](http://localhost:3000/command-center)
- **Projects**: [http://localhost:3000/projects](http://localhost:3000/projects)
- **Test Runs**: [http://localhost:3000/test-runs](http://localhost:3000/test-runs)
- **Bug Reports**: [http://localhost:3000/bug-reports](http://localhost:3000/bug-reports)
- **Certificates**: [http://localhost:3000/certificates](http://localhost:3000/certificates)
- **Integrations**: [http://localhost:3000/integrations](http://localhost:3000/integrations)
- **Analytics**: [http://localhost:3000/analytics](http://localhost:3000/analytics)

---

### 3. Local Demo Target Store Fixture

Veriqo includes a self-contained local target web store for deterministic, offline testing:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.demo_fixture --port 8080
```
- **Demo Store URL**: `http://127.0.0.1:8080`
- **Healthy Checkout Flow**: `http://127.0.0.1:8080/order`
- **Buggy Checkout Flow (Planted 500 Error)**: `http://127.0.0.1:8080/buggy-order`

---

## Verification & Automated Tests

### Backend Test Suite (Pytest)
Run all 133 automated unit and integration tests:
```powershell
cd backend
.\.venv\Scripts\pytest.exe tests -v
```
*Current result: **133 passed, 0 failures** in ~110 seconds.*

### Controlled Benchmark Suite
Run the 6 deterministic benchmark scenarios (`BM-01` to `BM-06`):
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_benchmark.py -v
```

### Frontend Code Quality & Production Build
```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```
*Current result: **0 errors, 0 warnings, 27 routes compiled successfully**.*

---

## Troubleshooting Guide

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| **Port 8000 or 3000 in use** | A previous instance is still running. | Run `Get-NetTCPConnection -LocalPort 8000` to find the PID, then terminate with `Stop-Process -Id <PID>`. |
| **Backend Unreachable in Frontend** | FastAPI is offline or wrong URL configured. | Verify `BACKEND_INTERNAL_URL=http://127.0.0.1:8000` in `frontend/.env.local` and ensure Uvicorn is active. |
| **Missing Browser Executable** | Playwright Chromium not installed. | Run `playwright install chromium chromium-headless-shell` in `backend/`. |
| **Database Contention (SQLite)** | Multi-threaded worker locks. | Veriqo uses WAL journal mode and 5000ms busy timeout. Restart Uvicorn if an external lock persists. |

---

## License

Internal proprietary release for VIT Apex evaluation.
