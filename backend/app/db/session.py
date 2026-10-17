"""Database engine, session management, and connectivity checks."""

import logging
from typing import Any, Dict, Generator
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure engine arguments
connect_args: Dict[str, Any] = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    connect_args["timeout"] = 15.0

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        """Enforces relational foreign keys, WAL mode, and busy timeout for concurrent safety."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:
    """Dependency yielding a database session with guaranteed closure."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_connection() -> bool:
    """Truthfully checks database connectivity by executing a test query."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("Database connectivity check failed: %s", exc)
        return False


def init_db() -> None:
    """Initialize database tables and seed baseline application if empty."""
    from app.db.base import Base
    import app.models  # noqa: F401 - ensure models are imported and registered
    from app.models.defect import Defect
    from app.models.target_app import TargetApp
    from app.models.test_run import TestRun

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully.")

        # Seed initial target application if database is completely empty
        with SessionLocal() as db:
            if db.query(TargetApp).count() == 0:
                demo_app = TargetApp(
                    name="Commerce Platform (Storefront Web)",
                    url="http://127.0.0.1:8080",
                    description="Environment: Staging | Swarm: Deep Heuristic",
                )
                db.add(demo_app)
                db.commit()
                db.refresh(demo_app)

                run = TestRun(
                    target_app_id=demo_app.id,
                    status="failed",
                    journey_definition={
                        "name": "E2E Checkout Race Condition Audit",
                        "actions": [
                            {"type": "navigate", "url": "/"},
                            {"type": "screenshot", "description": "catalog_landing"},
                            {"type": "click", "selector": "#nav-buggy"},
                            {"type": "fill", "selector": "#email-input", "value": "tester@veriqo.local"},
                            {"type": "click", "selector": "#submit-order-btn"},
                            {"type": "assert_text_visible", "text": "Order Confirmed: #1001"},
                        ],
                    },
                    error_message="Assertion failed: Expected visible text 'Order Confirmed: #1001' was not found",
                )
                db.add(run)
                db.commit()
                db.refresh(run)

                defect = Defect(
                    test_run_id=run.id,
                    title="Rapid Double-Click Order Submission Race Condition",
                    description="Duplicate order execution and unhandled 500 error triggered during high concurrency checkout.",
                    severity="CRITICAL",
                    status="OPEN",
                    reproduction_steps="1. Navigate to /buggy-order\n2. Fill customer email 'tester@veriqo.local'\n3. Click 'Submit Order' button rapidly\n4. Observe 500 database lock acquisition failure",
                    expected_behavior="Expected idempotency token to prevent duplicate order generation and display 'Order Confirmed: #1001'.",
                )
                db.add(defect)
                db.commit()
                logger.info("Seeded initial demo target application and verified baseline run.")
    except Exception as exc:
        logger.critical("Database initialization failed: %s", exc)
        raise

