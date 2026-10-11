# Veriqo — Backend API & QA Workflow

Veriqo is an Autonomous AI QA Engineer platform. This backend provides the core API foundation and Phase 2 Core QA Workflow for browser test execution, evidence capture, and regression baseline management using FastAPI, SQLite, SQLAlchemy, and Playwright Python.

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
│   │       └── regression_journeys.py  # Regression baselines & re-execution
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
│   │   └── regression_journey.py  # Saved regression journey model
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── health.py              # Health & readiness schemas
│   │   ├── journey.py             # Journey actions & execution reports
│   │   ├── target_app.py          # TargetApp DTO schemas
│   │   ├── test_run.py            # TestRun DTO schemas
│   │   ├── defect.py              # Defect DTO schemas
│   │   └── regression_journey.py  # Regression journey DTO schemas
│   └── services/
│       ├── __init__.py
│       └── browser.py       # Playwright browser runner & origin security guard
├── tests/
│   ├── __init__.py
│   ├── conftest.py                   # Pytest fixtures and local mock HTTP server
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
  ```json
  {
    "name": "Acme Web Store",
    "url": "http://127.0.0.1:3000",
    "description": "Local test store"
  }
  ```
- `GET /api/v1/target-apps`: List all registered applications.
- `GET /api/v1/target-apps/{id}`: Get application details.

### 2. Test Journey Execution
- `POST /api/v1/test-runs`: Launch an isolated browser context and execute a typed journey.
  Supported safe actions:
  - `navigate`: `{"type": "navigate", "url": "/cart"}`
  - `click`: `{"type": "click", "selector": "#checkout-btn"}`
  - `fill`: `{"type": "fill", "selector": "#promo-code", "value": "SAVE10"}`
  - `assert_text_visible`: `{"type": "assert_text_visible", "text": "Discount applied"}`
  - `assert_element_visible`: `{"type": "assert_element_visible", "selector": ".success-alert"}`

  Example execution payload:
  ```json
  {
    "target_app_id": 1,
    "journey": {
      "name": "Cart Checkout Journey",
      "actions": [
        {"type": "navigate", "url": "/"},
        {"type": "assert_text_visible", "text": "Welcome to Store"},
        {"type": "fill", "selector": "#search-input", "value": "laptop"},
        {"type": "click", "selector": "#search-btn"},
        {"type": "assert_element_visible", "selector": ".search-results"}
      ]
    }
  }
  ```
- `GET /api/v1/test-runs`: List test runs (optional `?target_app_id=1`).
- `GET /api/v1/test-runs/{id}`: Get run status, action results, and evidence paths.
- `GET /api/v1/test-runs/{id}/evidence`: List screenshots captured for the run.
- `GET /api/v1/test-runs/{id}/evidence/{filename}`: Securely stream screenshot images with directory traversal protection.

### 3. Regression Journeys
- `POST /api/v1/regression-journeys`: Save a completed passing run as a regression baseline.
  *(Refuses to save failed, timed out, or unexecuted runs).*
  ```json
  {
    "name": "Search & Checkout Baseline",
    "description": "Baseline journey for search flow",
    "baseline_test_run_id": 1
  }
  ```
- `GET /api/v1/regression-journeys`: List saved regression baselines.
- `GET /api/v1/regression-journeys/{id}`: Retrieve baseline details.
- `POST /api/v1/regression-journeys/{id}/execute`: Re-execute the saved journey via Playwright and record a new independent test run for regression comparison.

## Security & Reliability Design

1. **Origin Restriction**: Browser navigation is strictly constrained to the registered target application origin (`scheme://netloc`). Any attempt to navigate outside the allowed origin is blocked and recorded as a failure.
2. **Safe Typed Actions**: The API rejects arbitrary code, script execution, or shell commands. Only strictly typed, declarative browser interactions are supported.
3. **Resource Lifecycle**: Browser pages, contexts, and instances are guaranteed to be closed via `try/finally` blocks even upon unexpected step failures or timeouts.
4. **Path Traversal Protection**: Evidence retrieval sanitizes paths and asserts relative containment within `evidence/` before serving files.

## Running Automated Tests

Run the full automated test suite:

```powershell
pytest -v
```
