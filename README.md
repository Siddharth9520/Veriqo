# Veriqo — Autonomous AI QA Engineer

> **Tagline**: Intelligence That Tests Itself.  
> **Product Promise**: Ship with proof.

Veriqo is an autonomous AI quality engineering platform that explores web applications, executes typed browser test journeys, captures screenshot evidence, detects regressions, independently confirms defects using **BlindReplay**, computes deterministic QA scores, and issues cryptographic certificates of testing integrity.

---

## Architecture Overview

```text
VERIQO_VIT_Apex/
├── backend/                  # Python FastAPI Backend & Browser Automation
│   ├── app/                  # Application source (routers, models, services)
│   │   ├── api/v1/           # REST endpoints (apps, runs, defects, certs, replays)
│   │   ├── core/             # Configuration & security policies
│   │   ├── db/               # SQLite database session & engine
│   │   ├── models/           # SQLAlchemy 2.0 ORM models
│   │   ├── schemas/          # Pydantic v2 schemas
│   │   └── services/         # Playwright browser runner & BlindReplay engine
│   ├── tests/                # 115 pytest integration & unit tests
│   ├── requirements.txt      # Pinned Python dependencies
│   ├── .env.example          # Safe environment variable template
│   └── veriqo.db             # Persistent SQLite database
├── frontend/                 # Next.js 16 (React 19) Dashboard & Gateway
│   ├── app/                  # App Router pages & API Gateway Route Handlers
│   ├── components/           # Neo-brutalist Stitch UI components
│   ├── lib/                  # Typed API clients & gateway bridge
│   ├── package.json          # Node dependencies & build scripts
│   └── .env.example          # Safe frontend configuration template
├── start-dev.ps1             # Local development launcher for Windows
└── README.md                 # Root project documentation
```

---

## Prerequisites

Before setting up Veriqo locally on Windows, ensure the following tools are installed:

- **Python**: `3.10` to `3.12` (Python 3.11 recommended)
- **Node.js**: `20.x` or `22.x` / `24.x` (LTS)
- **npm**: `9.x` or newer
- **PowerShell**: Windows PowerShell 5.1 or PowerShell 7+
- **Playwright Chromium**: Automatically installed via CLI (instructions below)

---

## Quick Start (Automated Launcher)

You can launch both the backend and frontend simultaneously with the provided launcher:

```powershell
.\start-dev.ps1
```

Or open them in separate interactive PowerShell terminal windows:

```powershell
.\start-dev.ps1 -SeparateWindows
```

---

## Manual Setup & Installation (Step-by-Step)

### 1. Backend Setup

Open a PowerShell terminal and navigate to `backend`:

```powershell
cd backend

# Create Python virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install pinned dependencies
pip install -r requirements.txt

# Install Playwright browser binaries
playwright install chromium chromium-headless-shell

# Create local environment file
Copy-Item .env.example .env
```

Start the FastAPI backend service:

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- **Health Endpoint**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **Readiness Probe**: [http://127.0.0.1:8000/ready](http://127.0.0.1:8000/ready)
- **Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

### 2. Frontend Setup

In a second PowerShell terminal, navigate to `frontend`:

```powershell
cd frontend

# Install npm dependencies
npm install

# Create local environment configuration
Copy-Item .env.example .env.local
```

Start the Next.js development server:

```powershell
npm run dev
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Command Center**: [http://localhost:3000/command-center](http://localhost:3000/command-center)
- **Projects**: [http://localhost:3000/projects](http://localhost:3000/projects)
- **Test Runs**: [http://localhost:3000/test-runs](http://localhost:3000/test-runs)
- **Bug Reports**: [http://localhost:3000/bug-reports](http://localhost:3000/bug-reports)
- **Regression Library**: [http://localhost:3000/test-library](http://localhost:3000/test-library)
- **Analytics**: [http://localhost:3000/analytics](http://localhost:3000/analytics)

---

## Core Product Capabilities & Workflows

### 1. Autonomous Test Journeys
- Dispatches Playwright Chromium sessions against registered target applications.
- Enforces strict origin restrictions (navigation constrained to target origin).
- Captures step-by-step screenshots and execution logs in `backend/evidence/`.

### 2. Defect Intelligence & Show Me Mode
- Recorded defects track title, severity, reproduction steps, expected vs. actual behavior.
- **Show Me Mode (`GET /api/v1/defects/{id}/show-me`)**: Diagnoses failure root cause with screenshot evidence and replay logs.
- **Fix Prompt Generation (`GET /api/v1/defects/{id}/fix-prompt`)**: Produces structured Markdown bug reports for developer IDEs.

### 3. BlindReplay (Independent Reproduction)
- Re-executes the failure scenario in an **isolated browser context** without original script selectors, DOM state, or cookies.
- Updates defect status to `VERIFIED` strictly when the failure is demonstrably confirmed.

### 4. Deterministic Scoring & QA Certificates
- Computes reproducible quality scores from journey and assertion pass rates minus weighted defect penalties.
- Issues verifiable QA Certificates with canonical SHA-256 integrity hashes.
- Supports dual-mode tamper verification (`self_contained` and `database_backed`).

---

## Verification & Testing

### Backend Test Suite (Pytest)
Run the 115 automated backend tests:
```powershell
cd backend
.\.venv\Scripts\pytest.exe tests -v
```

### Frontend Code Quality & Production Build
Run TypeScript type-checking, ESLint, and Next.js production build:
```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

---

## Troubleshooting

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| **Port 8000 or 3000 in use** | A previous instance is still running. | Run `Get-NetTCPConnection -LocalPort 8000` to find the PID, then terminate it using `Stop-Process -Id <PID>`. |
| **Backend Unreachable in Frontend** | FastAPI is offline or wrong URL configured. | Verify `BACKEND_INTERNAL_URL=http://127.0.0.1:8000` in `frontend/.env.local` and ensure Uvicorn is active. |
| **Missing Browser Executable** | Playwright Chromium not installed. | Run `playwright install chromium chromium-headless-shell` inside `backend/`. |
| **CORS Rejected** | Origin not in backend allowlist. | Ensure backend `.env` includes `ALLOWED_HOSTS=["127.0.0.1", "localhost"]`. |
| **Database Locked (SQLite)** | Multiple concurrent write connections. | Veriqo backend uses a thread-safe SQLite connection pool with busy timeouts enabled. Restart Uvicorn if a lock persists. |

---

## License

Internal proprietary release for VIT Apex evaluation.
