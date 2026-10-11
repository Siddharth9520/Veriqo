# Veriqo — Backend Foundation

Veriqo is an Autonomous AI QA Engineer platform. This repository component provides the backend API foundation built with FastAPI, SQLite, and SQLAlchemy.

## Tech Stack

- **Framework**: FastAPI
- **Server**: Uvicorn
- **ORM / Database**: SQLAlchemy 2.0 with SQLite
- **Validation & Settings**: Pydantic v2 & Pydantic Settings
- **Testing**: Pytest & HTTPX (TestClient)

## Directory Structure

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Application entrypoint & health endpoints
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── router.py    # API v1 routes
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py        # Pydantic Settings configuration
│   │   └── logging.py       # Structured logging setup
│   ├── db/
│   │   ├── __init__.py
│   │   ├── base.py          # SQLAlchemy DeclarativeBase
│   │   └── session.py       # Engine, SessionLocal, and DB health checks
│   ├── models/
│   │   ├── __init__.py
│   │   ├── target_app.py    # Target application under test
│   │   ├── test_run.py      # Test execution run record
│   │   └── defect.py        # Detected defect report
│   └── schemas/
│       ├── __init__.py
│       ├── health.py        # Health & readiness schemas
│       ├── target_app.py    # TargetApp DTO schemas
│       ├── test_run.py      # TestRun DTO schemas
│       └── defect.py        # Defect DTO schemas
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Pytest fixtures and test database setup
│   ├── test_db.py           # Database connection and model CRUD tests
│   └── test_health.py       # /health and /ready endpoint verification
├── .env.example             # Safe environment variable defaults
├── requirements.txt         # Minimal dependency manifest
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

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 3. Environment Configuration

Copy `.env.example` to `.env` if customization is needed:

```powershell
Copy-Item .env.example .env
```

Default configuration will connect to a local SQLite database file `veriqo.db`.

## Running the API

Start the Uvicorn development server:

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Or run via Python module:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive documentation:
- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## Health & Readiness Endpoints

- **`GET /health`**: Process-level liveness probe. Returns HTTP 200 with service version and timestamp when the web server is running.
  ```json
  {
    "status": "ok",
    "version": "0.1.0",
    "timestamp": "2026-10-11T14:00:00Z"
  }
  ```
- **`GET /ready`**: Dependency readiness probe. Directly executes a query against SQLite. Returns HTTP 200 with `status: ready` if connected; returns HTTP 503 with `status: unavailable` if degraded or unreachable.
  ```json
  {
    "status": "ready",
    "database": "connected",
    "timestamp": "2026-10-11T14:00:00Z"
  }
  ```

## Running Automated Tests

Run the test suite using pytest:

```powershell
pytest -v
```
