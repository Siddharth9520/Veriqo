"""Automated regression test verifying the 6 controlled benchmark scenarios."""

from app.benchmark import run_controlled_benchmark


def test_controlled_benchmark_scenarios_pass_deterministically():
    """Executes all 6 controlled benchmark scenarios and asserts 100% deterministic pass."""
    results = run_controlled_benchmark()
    assert len(results) == 6, f"Expected 6 benchmark scenarios, got {len(results)}"

    failed_scenarios = [r for r in results if not r.passed]
    assert not failed_scenarios, f"Failed benchmark scenarios: {failed_scenarios}"

    # Verify individual scenario outcomes
    outcome_map = {r.scenario_id: r for r in results}

    assert outcome_map["BM-01"].actual_outcome == "passed"
    assert outcome_map["BM-02"].actual_outcome == "failed"
    assert outcome_map["BM-03"].actual_outcome == "CONFIRMED"
    assert outcome_map["BM-04"].actual_outcome == "NOT_REPRODUCED"
    assert outcome_map["BM-05"].actual_outcome == "INCONCLUSIVE"
    assert outcome_map["BM-06"].actual_outcome == "TAMPER_DETECTED"
