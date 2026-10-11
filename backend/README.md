# Veriqo — Backend API & QA Workflow

Veriqo is an Autonomous AI QA Engineer platform. This backend provides the core API foundation, Core QA Workflow for browser testing, and **BlindReplay** for independent defect verification using FastAPI, SQLite, SQLAlchemy, and Playwright Python.

## Tech Stack

- **Framework**: FastAPI
- **Server**: Uvicorn
- **ORM / Database**: SQLAlchemy 2.0 with SQLite
- **Validation & Settings**: Pydantic v2 & Pydantic Settings
- **Browser Automation**: Playwright Python (Chromium Headless Shell)
- **Testing**: Pytest & HTTPX (TestClient)

## Directory Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Application entrypoint & health/readiness probes
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py               # API v1 master router
│   │       ├── target_apps.py          # Target application management
│   │       ├── test_runs.py            # Test run execution and evidence
│   │       ├── regression_journeys.py  # Regression baselines & re-execution
│   │       ├── defects.py              # Defect management
│   │       └── replays.py              # BlindReplay endpoints
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py        # Settings (DB, timeouts, evidence directory)
│   │   └── logging.py       # Structured logging setup
│   ├── db/
│   │   ├── __init__.py
│   │   ├── base.py          # SQLAlchemy DeclarativeBase
│   │   └── session.py       # Engine, SessionLocal, and DB health checks
│   ├── models/
│   │   ├── __init__.py
│   │   ├── target_app.py          # Target application model
│   │   ├── test_run.py            # Test run execution model
│   │   ├── defect.py              # Defect model
│   │   ├── regression_journey.py  # Saved regression journey model
│   │   └── replay_attempt.py      # Independent BlindReplay attempt model
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── health.py              # Health & readiness schemas
│   │   ├── journey.py             # Journey actions & execution reports
│   │   ├── target_app.py          # TargetApp DTO schemas
│   │   ├── test_run.py            # TestRun DTO schemas
│   │   ├── defect.py              # Defect DTO schemas
│   │   ├── regression_journey.py  # Regression journey DTO schemas
│   │   └── replay_attempt.py      # BlindReplay attempt schemas
│   └── services/
│       ├── __init__.py
│       ├── browser.py       # Playwright browser runner & origin security guard
│       └── blind_replay.py  # Independent BlindReplay execution engine
├── tests/
│   ├── __init__.py
│   ├── conftest.py                   # Pytest fixtures and local mock HTTP server
│   ├── test_blind_replay.py          # Independent BlindReplay verification tests
│   ├── test_browser_workflow.py      # Real Playwright execution & evidence tests
│   ├── test_db.py                    # Database connection and model CRUD tests
│   ├── test_health.py                # /health and /ready endpoint verification
│   ├── test_journeys.py              # Journey schema and origin validation tests
│   ├── test_regression_journeys.py   # Regression save & re-execution tests
│   └── test_target_apps.py           # Target app registration & validation tests
├── .env.example             # Safe environment variable defaults
├── requirements.txt         # Pinned backend dependencies
└── README.md                # Backend documentation
```

## Setup & Installation (Windows PowerShell)

### 1. Create and Activate Virtual Environment

From within the `backend/` directory:

```powershell
cd D:\veriqo\Veriqo\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Install Dependencies & Playwright Browsers

```powershell
pip install -r requirements.txt
playwright install chromium chromium-headless-shell
```

### 3. Environment Configuration

Copy `.env.example` to `.env` if customization is needed:

```powershell
Copy-Item .env.example .env
```

Default configuration connects to a local SQLite database file `veriqo.db` and writes screenshots to `evidence/`.

## Running the API

Start the Uvicorn development server:

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive documentation:
- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## Core Workflow Endpoints (API v1)

### 1. Target Applications
- `POST /api/v1/target-apps`: Register a target web application.
- `GET /api/v1/target-apps`: List all registered applications.
- `GET /api/v1/target-apps/{id}`: Get application details.

### 2. Test Journey Execution
- `POST /api/v1/test-runs`: Launch an isolated browser context and execute a typed journey.
- `GET /api/v1/test-runs`: List test runs (optional `?target_app_id=1`).
- `GET /api/v1/test-runs/{id}`: Get run status, action results, and evidence paths.
- `GET /api/v1/test-runs/{id}/evidence`: List screenshots captured for the run.
- `GET /api/v1/test-runs/{id}/evidence/{filename}`: Securely stream screenshot images with directory traversal protection.

### 3. Regression Journeys
- `POST /api/v1/regression-journeys`: Save a completed passing run as a regression baseline.
- `GET /api/v1/regression-journeys`: List saved regression baselines.
- `GET /api/v1/regression-journeys/{id}`: Retrieve baseline details.
- `POST /api/v1/regression-journeys/{id}/execute`: Re-execute the saved journey via Playwright.

### 4. Defects Management
- `POST /api/v1/defects`: Record a defect.
  ```json
  {
    "test_run_id": 1,
    "title": "500 Error when submitting order",
    "description": "Submitting order returns internal 500 error instead of confirmation",
    "severity": "HIGH",
    "status": "OPEN",
    "reproduction_steps": "1. Navigate to /buggy-page\n2. Fill 'Email' with 'user@example.com'\n3. Click 'Submit Order'",
    "expected_behavior": "Expected 'Order Confirmed: Thank you!' to be visible"
  }
  ```
- `GET /api/v1/defects`: List recorded defects.
- `GET /api/v1/defects/{id}`: Get defect details.

### 5. BlindReplay (Independent Defect Verification)
BlindReplay independently verifies reported defects using **only**:
1. Target application URL
2. Human-readable reproduction instructions
3. Expected behavior / assertion

The replay runs in a **fresh browser context** without original scripts, selectors, DOM snapshots, logs, or cookies.

- `POST /api/v1/defects/{defect_id}/replay`: Initiate an independent BlindReplay attempt.
- `GET /api/v1/defects/{defect_id}/replays`: List all replay attempts for a defect.
- `GET /api/v1/replays/{replay_id}`: Retrieve a replay attempt with execution log and outcome.
- `GET /api/v1/replays/{replay_id}/evidence`: List evidence files captured during replay.
- `GET /api/v1/replays/{replay_id}/evidence/{filename}`: Download replay screenshot.

#### BlindReplay Outcomes
- `CONFIRMED`: The expected behavior is demonstrably violated with captured evidence; updates defect status to `VERIFIED`.
- `NOT_REPRODUCED`: The attempt completed, but the reported failure was not reproduced (defect is NOT invalidated).
- `INCONCLUSIVE`: The instructions or evidence are ambiguous or cannot locate elements.
- `FAILED`: Execution could not complete due to an infrastructure or process error.
- `TIMED_OUT`: The replay exceeded its execution timeout limit.

## Security & Reliability Design

1. **Origin Restriction**: Browser navigation is strictly constrained to the registered target application origin (`scheme://netloc`). Any attempt to navigate outside the allowed origin is blocked and recorded as a failure.
2. **Safe Typed Actions**: The API rejects arbitrary code, script execution, or shell commands.
3. **Strict Independence Contract**: BlindReplay receives only high-level human instructions, user-facing role locators, and expected outcomes.
4. **Resource Lifecycle**: Browser pages, contexts, and instances are guaranteed to be closed via `try/finally` blocks even upon unexpected step failures or timeouts.
5. **Path Traversal Protection**: Evidence retrieval sanitizes paths and asserts relative containment within `evidence/` before serving files.

## Running Automated Tests

Run the full automated test suite:

```powershell
pytest -v
```
