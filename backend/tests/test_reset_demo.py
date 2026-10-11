"""Unit tests for the safe demo data reset utility using an isolated in-memory database."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.certificate import Certificate
from app.models.defect import Defect
from app.models.regression_journey import RegressionJourney
from app.models.replay_attempt import ReplayAttempt
from app.models.target_app import TargetApp
from app.models.test_run import TestRun
from app.reset_demo import reset_demo_data


@pytest.fixture
def isolated_engine():
    """Creates a completely isolated in-memory SQLite engine with foreign key enforcement."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys = ON;")
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


def test_reset_demo_preserves_user_apps_by_default(isolated_engine):
    """Verifies that demo reset purges only demo records and preserves ordinary user applications."""
    Session = sessionmaker(bind=isolated_engine)
    with Session() as session:
        # Create normal user application with a run and defect
        user_app = TargetApp(name="Production E-Commerce", url="https://shop.example.com")
        session.add(user_app)
        session.flush()

        user_run = TestRun(
            target_app_id=user_app.id,
            journey_definition={"name": "Prod Flow", "actions": []},
            status="passed",
        )
        session.add(user_run)
        session.flush()

        user_defect = Defect(
            test_run_id=user_run.id,
            title="Prod Issue",
            description="Production problem",
            severity="LOW",
            status="OPEN",
            reproduction_steps="1. Step",
            expected_behavior="Expected",
        )
        session.add(user_defect)

        # Create demo application with run, defect, and cert
        demo_app = TargetApp(name="[Demo] Veriqo Store", url="http://127.0.0.1:8080")
        session.add(demo_app)
        session.flush()

        demo_run = TestRun(
            target_app_id=demo_app.id,
            journey_definition={"name": "Demo Flow", "actions": []},
            status="failed",
        )
        session.add(demo_run)
        session.flush()

        demo_defect = Defect(
            test_run_id=demo_run.id,
            title="Demo Issue",
            description="Demo problem",
            severity="HIGH",
            status="OPEN",
            reproduction_steps="1. Step",
            expected_behavior="Expected",
        )
        session.add(demo_defect)
        session.flush()

        demo_cert = Certificate(
            certificate_id="cert-demo-001",
            target_app_id=demo_app.id,
            status="ISSUED",
            score=90,
            grade="A",
            tamper_hash="hash123",
            certificate_data={"overall_score": 90},
        )
        session.add(demo_cert)

        demo_reg = RegressionJourney(
            target_app_id=demo_app.id,
            name="Demo Regression",
            journey_definition={"name": "Demo Regression", "actions": []},
            baseline_test_run_id=demo_run.id,
        )
        session.add(demo_reg)

        user_app_id = user_app.id
        session.commit()

    # Perform safe demo reset on isolated database
    counts = reset_demo_data(demo_only=True, db_engine=isolated_engine)

    assert counts["target_apps"] == 1
    assert counts["test_runs"] == 1
    assert counts["defects"] == 1
    assert counts["certificates"] == 1
    assert counts["regression_journeys"] == 1

    # Verify that user application is completely preserved!
    with Session() as session:
        remaining_apps = session.query(TargetApp).all()
        assert len(remaining_apps) == 1
        assert remaining_apps[0].name == "Production E-Commerce"

        remaining_runs = session.query(TestRun).all()
        assert len(remaining_runs) == 1
        assert remaining_runs[0].target_app_id == user_app_id

        remaining_defects = session.query(Defect).all()
        assert len(remaining_defects) == 1
        assert remaining_defects[0].title == "Prod Issue"


def test_reset_demo_specific_app_id(isolated_engine):
    """Verifies resetting by specific target_app_id."""
    Session = sessionmaker(bind=isolated_engine)
    with Session() as session:
        app1 = TargetApp(name="App One", url="http://app1.local")
        app2 = TargetApp(name="App Two", url="http://app2.local")
        session.add_all([app1, app2])
        session.commit()
        app1_id = app1.id
        app2_id = app2.id

    counts = reset_demo_data(target_app_id=app1_id, db_engine=isolated_engine)
    assert counts["target_apps"] == 1

    with Session() as session:
        remaining = session.query(TargetApp).all()
        assert len(remaining) == 1
        assert remaining[0].id == app2_id
