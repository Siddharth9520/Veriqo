"""Deterministic Controlled Functional Benchmark for Veriqo.

Executes a small, reproducible set of 6 controlled scenarios against the local
test stack without external websites, paid services, API keys, or LLM dependencies.

Scenarios:
1. Journey execution that passes (happy path navigation & assertion).
2. Journey execution that fails on a known assertion (deterministic assertion failure).
3. Defect that BlindReplay independently confirms (buggy flow reproduces violation).
4. Defect that BlindReplay does NOT reproduce (working flow satisfies expected behavior).
5. Defect with insufficient / ambiguous instructions causing INCONCLUSIVE replay.
6. Certificate integrity verification that detects payload tampering.

Note: This is a controlled functional verification benchmark and does not represent
real-world statistical accuracy or precision/recall metrics.
"""

from dataclasses import dataclass
from http.server import HTTPServer
import threading
import time
from typing import Any, Dict, List, Optional
from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import engine, get_db
from app.main import app
from app.services.scoring import verify_certificate_self_contained
from tests.conftest import MockWebHandler, TestingSessionLocal


@dataclass
class BenchmarkResult:
    scenario_id: str
    scenario_name: str
    expected_outcome: str
    actual_outcome: str
    passed: bool
    evidence_or_id: str
    known_limitations: str


def run_controlled_benchmark() -> List[BenchmarkResult]:
    """Runs all 6 controlled benchmark scenarios and returns structured results."""
    results: List[BenchmarkResult] = []

    # 1. Start local ephemeral mock HTTP server
    server = HTTPServer(("127.0.0.1", 0), MockWebHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{port}"

    # 2. Prepare test client with fresh schema
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal(bind=engine.connect())

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        # Register benchmark target app
        app_resp = client.post(
            "/api/v1/target-apps",
            json={"name": "Benchmark Target App", "url": base_url},
        )
        assert app_resp.status_code == 201
        target_app_id = app_resp.json()["id"]

        # -------------------------------------------------------------------
        # Scenario 1: A journey that passes
        # -------------------------------------------------------------------
        run_pass_resp = client.post(
            "/api/v1/test-runs",
            json={
                "target_app_id": target_app_id,
                "journey": {
                    "name": "Benchmark Happy Path",
                    "actions": [
                        {"type": "navigate", "url": "/"},
                        {"type": "assert_text_visible", "text": "Welcome to Veriqo Test App"},
                    ],
                },
            },
        )
        pass_run_data = run_pass_resp.json()
        pass_status = pass_run_data.get("status")
        sc1_passed = (pass_status == "passed")
        results.append(
            BenchmarkResult(
                scenario_id="BM-01",
                scenario_name="Journey Happy Path",
                expected_outcome="passed",
                actual_outcome=str(pass_status),
                passed=sc1_passed,
                evidence_or_id=f"run_id={pass_run_data.get('id')}",
                known_limitations="Assumes browser is installed and can render in-process HTTP.",
            )
        )

        # -------------------------------------------------------------------
        # Scenario 2: A journey that fails on a known assertion
        # -------------------------------------------------------------------
        run_fail_resp = client.post(
            "/api/v1/test-runs",
            json={
                "target_app_id": target_app_id,
                "journey": {
                    "name": "Benchmark Known Assertion Failure",
                    "actions": [
                        {"type": "navigate", "url": "/"},
                        {"type": "assert_text_visible", "text": "NON_EXISTENT_TEXT_IN_DOM"},
                    ],
                },
            },
        )
        fail_run_data = run_fail_resp.json()
        fail_status = fail_run_data.get("status")
        sc2_passed = (fail_status == "failed")
        results.append(
            BenchmarkResult(
                scenario_id="BM-02",
                scenario_name="Journey Assertion Failure",
                expected_outcome="failed",
                actual_outcome=str(fail_status),
                passed=sc2_passed,
                evidence_or_id=f"run_id={fail_run_data.get('id')}",
                known_limitations="Deterministic assertion failure classified as failed (not timed_out).",
            )
        )

        # -------------------------------------------------------------------
        # Scenario 3: A failure that BlindReplay independently confirms
        # -------------------------------------------------------------------
        defect_confirmed_resp = client.post(
            "/api/v1/defects",
            json={
                "test_run_id": fail_run_data.get("id"),
                "title": "500 Error Submitting Order",
                "description": "Order submission displays Internal Server Error: 500",
                "severity": "HIGH",
                "status": "OPEN",
                "reproduction_steps": (
                    "1. Navigate to /buggy-page\n"
                    "2. Fill 'Email' with 'user@example.com'\n"
                    "3. Click 'Submit Order'"
                ),
                "expected_behavior": "Expected 'Order Confirmed: Thank you!' to be visible",
            },
        )
        defect_conf_id = defect_confirmed_resp.json()["id"]
        replay_conf_resp = client.post(f"/api/v1/defects/{defect_conf_id}/replay")
        conf_replay_data = replay_conf_resp.json()
        conf_outcome = conf_replay_data.get("outcome")
        sc3_passed = (conf_outcome == "CONFIRMED")
        results.append(
            BenchmarkResult(
                scenario_id="BM-03",
                scenario_name="BlindReplay Confirmation",
                expected_outcome="CONFIRMED",
                actual_outcome=str(conf_outcome),
                passed=sc3_passed,
                evidence_or_id=f"replay_id={conf_replay_data.get('id')}",
                known_limitations="Requires distinct positive or negative text assertion.",
            )
        )

        # -------------------------------------------------------------------
        # Scenario 4: A failure that BlindReplay cannot reproduce
        # -------------------------------------------------------------------
        defect_not_repro_resp = client.post(
            "/api/v1/defects",
            json={
                "test_run_id": fail_run_data.get("id"),
                "title": "False Alarm Defect on Working Form",
                "description": "Incorrectly claimed working form was broken",
                "severity": "LOW",
                "status": "OPEN",
                "reproduction_steps": (
                    "1. Navigate to /working-page\n"
                    "2. Fill 'Email' with 'user@example.com'\n"
                    "3. Click 'Submit Order'"
                ),
                "expected_behavior": "Expected 'Order Confirmed: Thank you!' to be visible",
            },
        )
        defect_nr_id = defect_not_repro_resp.json()["id"]
        replay_nr_resp = client.post(f"/api/v1/defects/{defect_nr_id}/replay")
        nr_replay_data = replay_nr_resp.json()
        nr_outcome = nr_replay_data.get("outcome")
        sc4_passed = (nr_outcome == "NOT_REPRODUCED")
        results.append(
            BenchmarkResult(
                scenario_id="BM-04",
                scenario_name="BlindReplay Not Reproduced",
                expected_outcome="NOT_REPRODUCED",
                actual_outcome=str(nr_outcome),
                passed=sc4_passed,
                evidence_or_id=f"replay_id={nr_replay_data.get('id')}",
                known_limitations="Page content satisfies expected behavior; defect remains unverified.",
            )
        )

        # -------------------------------------------------------------------
        # Scenario 5: An inconclusive case caused by insufficient evidence
        # -------------------------------------------------------------------
        defect_inconc_resp = client.post(
            "/api/v1/defects",
            json={
                "test_run_id": fail_run_data.get("id"),
                "title": "Ambiguous Defect Instructions",
                "description": "Reproduction instructions cannot be matched to page elements",
                "severity": "MEDIUM",
                "status": "OPEN",
                "reproduction_steps": "1. Click the mysterious hidden unclickable widget",
                "expected_behavior": "Should work magically",
            },
        )
        defect_inconc_id = defect_inconc_resp.json()["id"]
        replay_inconc_resp = client.post(f"/api/v1/defects/{defect_inconc_id}/replay")
        inconc_replay_data = replay_inconc_resp.json()
        inconc_outcome = inconc_replay_data.get("outcome")
        sc5_passed = (inconc_outcome == "INCONCLUSIVE")
        results.append(
            BenchmarkResult(
                scenario_id="BM-05",
                scenario_name="BlindReplay Inconclusive",
                expected_outcome="INCONCLUSIVE",
                actual_outcome=str(inconc_outcome),
                passed=sc5_passed,
                evidence_or_id=f"replay_id={inconc_replay_data.get('id')}",
                known_limitations="Instructions could not be mapped to user-visible page elements.",
            )
        )

        # -------------------------------------------------------------------
        # Scenario 6: A certificate whose integrity check detects tampering
        # -------------------------------------------------------------------
        cert_resp = client.post(f"/api/v1/target-apps/{target_app_id}/certificates")
        assert cert_resp.status_code == 201
        cert_data = cert_resp.json()

        # Tamper payload score
        tampered_data = dict(cert_data["certificate_data"])
        tampered_data["score_summary"] = dict(tampered_data["score_summary"])
        tampered_data["score_summary"]["score"] = 100  # Falsified score
        tampered_data["score_summary"]["grade"] = "A"

        verify_tampered = client.post(
            "/api/v1/certificates/verify",
            json={
                "mode": "self_contained",
                "certificate_data": tampered_data,
                "tamper_hash": cert_data["tamper_hash"],
            },
        )
        verify_data = verify_tampered.json()
        tamper_detected = (
            verify_data.get("checksum_valid") is False
            or verify_data.get("math_valid") is False
        )
        actual_tamper_outcome = (
            "TAMPER_DETECTED" if tamper_detected else "TAMPER_ACCEPTED"
        )
        sc6_passed = tamper_detected
        results.append(
            BenchmarkResult(
                scenario_id="BM-06",
                scenario_name="Certificate Tamper Detection",
                expected_outcome="TAMPER_DETECTED",
                actual_outcome=actual_tamper_outcome,
                passed=sc6_passed,
                evidence_or_id=f"cert_id={cert_data.get('certificate_id')}",
                known_limitations="Evaluates SHA-256 payload integrity; does not verify external PKI issuer.",
            )
        )

    finally:
        app.dependency_overrides.clear()
        server.shutdown()
        server.server_close()

    return results


def print_benchmark_table(results: List[BenchmarkResult]) -> None:
    """Prints a formatted ASCII/Markdown benchmark summary table."""
    print("\n" + "=" * 95)
    print("           VERIQO CONTROLLED FUNCTIONAL BENCHMARK (PHASE 7)")
    print("=" * 95)
    print(f"{'ID':<7} | {'Scenario':<30} | {'Expected':<16} | {'Actual':<16} | {'Status':<6}")
    print("-" * 95)
    all_passed = True
    for r in results:
        status_str = "PASS" if r.passed else "FAIL"
        if not r.passed:
            all_passed = False
        print(
            f"{r.scenario_id:<7} | {r.scenario_name:<30} | {r.expected_outcome:<16} | "
            f"{r.actual_outcome:<16} | {status_str:<6}"
        )
    print("=" * 95)
    total = len(results)
    passed_count = sum(1 for r in results if r.passed)
    print(f"Summary: {passed_count}/{total} scenarios satisfied deterministic expectation.")
    print("Disclaimer: Controlled functional benchmark for demo & regression verification.")
    print("=" * 95 + "\n")


if __name__ == "__main__":
    benchmark_results = run_controlled_benchmark()
    print_benchmark_table(benchmark_results)
