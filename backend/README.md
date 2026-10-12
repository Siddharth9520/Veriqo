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
cd backend
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
- `PATCH /api/v1/defects/{id}`: Partially update mutable defect fields.

  Permitted fields: `severity`, `status`, `description`, `reproduction_steps`, `expected_behavior`.

  Immutable fields (`id`, `test_run_id`, `title`) cannot be changed. Unknown fields are rejected with HTTP 422.
  An empty request body is valid and returns the unchanged defect (HTTP 200).

  **Allowed `severity` values**: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.

  **Allowed `status` values via API**: `OPEN`, `IN_PROGRESS`, `CLOSED`, `WONT_FIX`.
  `VERIFIED` is not an allowed caller-set value — it is set exclusively by BlindReplay when a replay outcome is `CONFIRMED`.
  Already-`VERIFIED` defects cannot have their status mutated via PATCH (HTTP 409).

- `GET /api/v1/defects/{id}/show-me`: **Show Me Mode** — Explains a reported defect using actual stored evidence and replay outcomes. Returns defect context, verified/missing screenshots, execution logs, and diagnostic explanations. Strictly read-only; redacts secrets.
- `GET /api/v1/defects/{id}/fix-prompt`: **Fix Prompt Export** — Generates a structured, developer-ready prompt in copyable Markdown format, including verified facts, reproduction steps, evidence references, and BlindReplay trust boundary details. Strictly read-only; redacts secrets.

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

### 6. Deterministic Scoring & QA Certificates
Deterministic scoring and verifiable QA certificates provide reproducible quality measurement without subjective LLM evaluations.

- `POST /api/v1/target-apps/{app_id}/certificates`: Issue a deterministic QA Certificate for evaluated terminal runs.
- `GET /api/v1/target-apps/{app_id}/certificates`: List issued certificates for a target application.
- `GET /api/v1/certificates/{cert_id}`: Retrieve certificate strictly by public certificate ID (prevents sequential integer primary key scraping).
- `POST /api/v1/certificates/verify`: Dual-mode verification of certificate payload integrity and mathematical consistency.

#### Scoring Policy & Penalties
- **Base Score**: 50% journey pass rate + 50% evaluated assertion pass rate (or 100% journey pass rate if no assertions were evaluated). Unreached assertions are excluded.
- **Defect Penalties**: Deduplicated by normalized `(title, reproduction_steps)` and penalized once:
  - Verified Finding (`CONFIRMED` replay): Critical = 35.0, High = 20.0, Medium = 10.0, Low = 5.0 points.
  - Non-Verified Finding (no `CONFIRMED` replay): 50% of the corresponding severity penalty.
- **Evidence Audit Deductions**: 5.0 points deducted per missing expected evidence artifact.
- **Hard Caps**:
  - Assertionless suite: capped at 75 points (Grade C).
  - Verified High defect: capped at 65 points (Grade D).
  - Verified Critical defect: capped at 40 points (Grade F).
- **Rounding & Grades**: Unrounded intermediate values; final score half-up rounded (`floor(score + 0.5)`). Pure numerical grade bands: A (90–100), B (80–89), C (70–79), D (60–69), F (0–59), and `UNTESTED` for 0 eligible runs.

#### Verification Trust Boundaries
1. **Self-Contained Verification (`self_contained`)**: Re-executes the pure mathematical scoring formula from immutable inputs and verifies canonical SHA-256 integrity without trusting database records or caller summaries.
2. **Database-Backed Verification (`database_backed`)**: Compares submitted canonical JSON and hash against stored database records. `system_matched` is reported independently of mathematical consistency (detecting corrupted stored records).
3. **Issuer Authentication**: `issuer_verified` remains strictly `false`. An unkeyed SHA-256 hash guarantees data integrity against accidental tampering, but does not provide digital signatures, PKI, or public non-repudiation.

## Security & Reliability Design

1. **Origin Restriction**: Browser navigation is strictly constrained to the registered target application origin (`scheme://netloc`). Any attempt to navigate outside the allowed origin is blocked and recorded as a failure.
2. **Safe Typed Actions**: The API rejects arbitrary code, script execution, or shell commands.
3. **Strict Independence Contract**: BlindReplay receives only high-level human instructions, user-facing role locators, and expected outcomes.
4. **Resource Lifecycle**: Browser pages, contexts, and instances are guaranteed to be closed via `try/finally` blocks even upon unexpected step failures or timeouts.
5. **Path Traversal Protection**: Evidence retrieval sanitizes paths and asserts relative containment within `evidence/` before serving files.

## Local Demo Target Fixture

Veriqo provides an in-tree, reproducible local web target fixture (`app.demo_fixture`) that requires no external network calls, credentials, or LLMs. It binds strictly to `127.0.0.1` (loopback only) and serves:
- `/` — Healthy home page (`#welcome-heading`, `#nav-healthy`, `#nav-buggy`)
- `/order` — Healthy checkout flow (updates `#order-status` to `"Order Confirmed: #1001"`)
- `/buggy-order` — Known failing scenario (updates `#order-status` to `"Internal Server Error: 500"`, displaying `#error-badge`)

### Startup & Shutdown

```powershell
# Start local fixture on port 8080 (loopback only)
python -m app.demo_fixture --port 8080

# To stop: Press Ctrl+C in the terminal.
```

## Controlled Functional Benchmark

To execute the 6 deterministic verification scenarios against local targets:

```powershell
python -m app.benchmark
```

## Safe Demo Data Reset

To reset disposable demo records without touching ordinary user applications or database schemas:

```powershell
# Resets only demo records (target apps matching '[Demo]', 'Demo', or localhost test origin)
python -m app.reset_demo --confirm

# Reset a single target app by ID
python -m app.reset_demo --confirm --app-id <TARGET_APP_ID>

# Full database wipe (requires explicit confirmation flags)
python -m app.reset_demo --confirm --all --force
```

## Running Automated Tests

Run the full automated test suite:

```powershell
pytest -v
```
