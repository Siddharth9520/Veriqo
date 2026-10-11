"""Automated tests for deterministic scoring and certificate integrity service."""

from datetime import datetime, timezone
import math
from pathlib import Path
import pytest

from app.services.scoring import (
    SCORING_POLICY_VERSION,
    audit_evidence,
    calculate_qa_score,
    compute_integrity_hash,
    deduplicate_defects,
    generate_certificate_payload,
    normalize_text,
    serialize_deterministic,
    verify_certificate_self_contained,
)


def test_deterministic_json_serialization_sorting_and_whitespace():
    """Verifies that dict keys are sorted and serialization produces identical compact bytes regardless of key insertion order."""
    dict_a = {"b": 2, "a": 1, "nested": {"z": 10, "m": 5}}
    dict_b = {"nested": {"m": 5, "z": 10}, "a": 1, "b": 2}

    bytes_a = serialize_deterministic(dict_a)
    bytes_b = serialize_deterministic(dict_b)

    assert bytes_a == bytes_b
    assert b'{"a":1,"b":2,"nested":{"m":5,"z":10}}' == bytes_a


def test_deterministic_json_rejects_non_finite_numbers():
    """Verifies that NaN, Infinity, and -Infinity are rejected with ValueError."""
    with pytest.raises(ValueError, match="Non-finite numbers"):
        serialize_deterministic({"invalid": float("nan")})

    with pytest.raises(ValueError, match="Non-finite numbers"):
        serialize_deterministic({"invalid": float("inf")})

    with pytest.raises(ValueError, match="Non-finite numbers"):
        serialize_deterministic({"invalid": float("-inf")})


def test_deterministic_json_floats_and_timestamps():
    """Verifies float rounding to 4 decimals and ISO UTC formatting."""
    dt = datetime(2026, 10, 11, 12, 0, 0, tzinfo=timezone.utc)
    data = {
        "score": 83.333333333,
        "timestamp": dt,
    }
    serialized = serialize_deterministic(data)
    assert b'"score":83.3333' in serialized
    assert b'"timestamp":"2026-10-11T12:00:00.000000Z"' in serialized


def test_compute_integrity_hash_excludes_tamper_hash():
    """Verifies that compute_integrity_hash produces the same hash whether tamper_hash is present in input or not."""
    payload = {"certificate_id": "cert_123", "score": 95}
    hash_1 = compute_integrity_hash(payload)

    payload_with_hash = {"certificate_id": "cert_123", "score": 95, "tamper_hash": "existing_hash_value"}
    hash_2 = compute_integrity_hash(payload_with_hash)

    assert hash_1 == hash_2
    assert len(hash_1) == 64


def test_normalize_text():
    """Verifies lowercase conversion, whitespace collapsing, and none handling."""
    assert normalize_text("  500   Internal   SERVER   Error  ") == "500 internal server error"
    assert normalize_text(None) == ""
    assert normalize_text("") == ""


def test_untested_app_returns_untested_status():
    """Verifies that an app with zero eligible runs returns status='UNTESTED', score=None, grade=None."""
    res = calculate_qa_score(runs=[], defects=[])
    assert res["status"] == "UNTESTED"
    assert res["score"] is None
    assert res["grade"] is None
    assert res["evaluation_scope"]["eligible_runs_count"] == 0


def test_assertionless_run_capped_at_75():
    """Verifies that a suite with 100% passing runs but zero assertions is capped at 75 (Grade C)."""
    runs = [
        {
            "id": 1,
            "status": "passed",
            "action_results": [
                {"action_type": "navigate", "status": "passed"},
                {"action_type": "click", "status": "passed"},
            ],
        },
        {
            "id": 2,
            "status": "passed",
            "action_results": [
                {"action_type": "navigate", "status": "passed"},
                {"action_type": "fill", "status": "passed"},
            ],
        },
    ]
    res = calculate_qa_score(runs=runs, defects=[])
    assert res["status"] == "ISSUED"
    assert res["base_score"] == 100.0
    assert res["score"] == 75
    assert res["grade"] == "C"
    assert "NO_ASSERTIONS_EVALUATED_CAP_75" in res["caps_applied"]
    assert res["evaluation_scope"]["total_assertions_evaluated"] == 0
    assert res["evaluation_scope"]["assertion_pass_rate"] is None


def test_assertions_not_reached_are_not_counted():
    """Verifies that assertions unreached because of an earlier step failure are not counted as evaluated or failed."""
    # Journey had 4 actions, but runner halted on action 0 (navigate failed).
    # Actions 1, 2, 3 (which included assertions) were never executed and are absent from action_results.
    runs = [
        {
            "id": 1,
            "status": "failed",
            "action_results": [
                {"action_type": "navigate", "status": "failed", "error": "net::ERR_CONNECTION_REFUSED"},
            ],
        }
    ]
    res = calculate_qa_score(runs=runs, defects=[])
    assert res["evaluation_scope"]["total_actions_evaluated"] == 1
    assert res["evaluation_scope"]["total_assertions_evaluated"] == 0
    assert res["evaluation_scope"]["passed_assertions_count"] == 0
    assert res["evaluation_scope"]["failed_assertions_count"] == 0
    assert res["score"] == 0
    assert res["grade"] == "F"


def test_defect_deduplication_and_source_ids_preservation():
    """Verifies that defects with same normalized title/steps are deduplicated into one finding, preserving all source IDs."""
    defects = [
        {
            "id": 101,
            "title": "  Button   Click Fails  ",
            "reproduction_steps": "1. Go to /\n2. Click 'Buy'",
            "severity": "MEDIUM",
            "replays": [],
        },
        {
            "id": 102,
            "title": "button click fails",
            "reproduction_steps": "1. go to /\n2. click 'buy'",
            "severity": "HIGH",
            "replays": [{"id": 5, "outcome": "NOT_REPRODUCED", "evidence_paths": []}],
        },
    ]
    findings = deduplicate_defects(defects)
    assert len(findings) == 1
    f = findings[0]
    assert f["source_defect_ids"] == [101, 102]
    # Highest severity resolved: HIGH
    assert f["severity"] == "HIGH"
    # Not verified (only NOT_REPRODUCED)
    assert f["is_verified"] is False
    # Non-verified HIGH penalty: 20 * 0.5 = 10.0
    assert f["penalty_applied"] == 10.0
    assert len(f["replay_history"]) == 1
    assert f["replay_history"][0]["replay_id"] == 5


def test_defect_verified_only_on_confirmed_replay():
    """Verifies that FAILED/TIMED_OUT/INCONCLUSIVE replays do not verify a defect; only CONFIRMED does."""
    defects = [
        {
            "id": 1,
            "title": "Checkout error",
            "reproduction_steps": "1. Checkout",
            "severity": "CRITICAL",
            "replays": [
                {"id": 10, "outcome": "FAILED", "evidence_paths": []},
                {"id": 11, "outcome": "TIMED_OUT", "evidence_paths": []},
                {"id": 12, "outcome": "INCONCLUSIVE", "evidence_paths": []},
            ],
        }
    ]
    findings = deduplicate_defects(defects)
    assert findings[0]["is_verified"] is False
    # Non-verified CRITICAL penalty: 35 * 0.5 = 17.5
    assert findings[0]["penalty_applied"] == 17.5

    # Add a CONFIRMED replay
    defects[0]["replays"].append({"id": 13, "outcome": "CONFIRMED", "evidence_paths": ["replay_13/confirmed.png"]})
    findings_confirmed = deduplicate_defects(defects)
    assert findings_confirmed[0]["is_verified"] is True
    # Verified CRITICAL penalty: 35.0
    assert findings_confirmed[0]["penalty_applied"] == 35.0
    assert findings_confirmed[0]["confirmed_evidence_path"] == "replay_13/confirmed.png"


def test_verified_critical_defect_hard_cap_40():
    """Verifies that a verified CRITICAL defect enforces a score cap of 40 (Grade F)."""
    # 9 passing runs with assertions
    runs = [
        {
            "id": i,
            "status": "passed",
            "action_results": [
                {"action_type": "navigate", "status": "passed"},
                {"action_type": "assert_text_visible", "status": "passed"},
            ],
        }
        for i in range(1, 10)
    ]
    defects = [
        {
            "id": 1,
            "title": "Data corruption",
            "reproduction_steps": "1. Save",
            "severity": "CRITICAL",
            "replays": [{"id": 1, "outcome": "CONFIRMED", "evidence_paths": []}],
        }
    ]
    res = calculate_qa_score(runs=runs, defects=defects)
    assert "VERIFIED_CRITICAL_DEFECT_CAP_40" in res["caps_applied"]
    # Base score = 100, Defect penalty = 35 -> Raw score = 65, capped at 40
    assert res["raw_score"] == 65.0
    assert res["score"] == 40
    assert res["grade"] == "F"


def test_verified_high_defect_hard_cap_65():
    """Verifies that a verified HIGH defect enforces a score cap of 65 (Grade D)."""
    runs = [
        {
            "id": i,
            "status": "passed",
            "action_results": [
                {"action_type": "navigate", "status": "passed"},
                {"action_type": "assert_text_visible", "status": "passed"},
            ],
        }
        for i in range(1, 10)
    ]
    defects = [
        {
            "id": 1,
            "title": "Broken checkout button",
            "reproduction_steps": "1. Click checkout",
            "severity": "HIGH",
            "replays": [{"id": 1, "outcome": "CONFIRMED", "evidence_paths": []}],
        }
    ]
    res = calculate_qa_score(runs=runs, defects=defects)
    assert "VERIFIED_HIGH_DEFECT_CAP_65" in res["caps_applied"]
    # Base score = 100, Defect penalty = 20 -> Raw score = 80, capped at 65
    assert res["raw_score"] == 80.0
    assert res["score"] == 65
    assert res["grade"] == "D"


def test_grade_boundaries_and_half_up_rounding():
    """Verifies exact grade boundaries for final scores: 59(F), 60(D), 69(D), 70(C), 79(C), 80(B), 89(B), 90(A)."""
    # Helper to test score -> grade
    def _evaluate_custom(base_score: float, deduction: float = 0.0):
        # 1 run, 1 assertion
        runs = [
            {
                "id": 1,
                "status": "passed",
                "action_results": [
                    {"action_type": "assert_text_visible", "status": "passed"},
                ],
            }
        ]
        audit = {"audit_deduction": deduction}
        # Override calculation by passing mock defect or checking math directly
        res = calculate_qa_score(runs=runs, defects=[], audit_result={"audit_deduction": 100.0 - base_score})
        return res["score"], res["grade"]

    # Boundary 59 / 60
    s_59, g_59 = _evaluate_custom(59.0)
    assert s_59 == 59 and g_59 == "F"
    s_60, g_60 = _evaluate_custom(60.0)
    assert s_60 == 60 and g_60 == "D"

    # Boundary 69 / 70
    s_69, g_69 = _evaluate_custom(69.0)
    assert s_69 == 69 and g_69 == "D"
    s_70, g_70 = _evaluate_custom(70.0)
    assert s_70 == 70 and g_70 == "C"

    # Boundary 79 / 80
    s_79, g_79 = _evaluate_custom(79.0)
    assert s_79 == 79 and g_79 == "C"
    s_80, g_80 = _evaluate_custom(80.0)
    assert s_80 == 80 and g_80 == "B"

    # Boundary 89 / 90
    s_89, g_89 = _evaluate_custom(89.0)
    assert s_89 == 89 and g_89 == "B"
    s_90, g_90 = _evaluate_custom(90.0)
    assert s_90 == 90 and g_90 == "A"

    # Half-up rounding: 89.5 rounds to 90 (Grade A), 89.4 rounds to 89 (Grade B)
    s_half_up, g_half_up = _evaluate_custom(89.5)
    assert s_half_up == 90 and g_half_up == "A"
    s_half_down, g_half_down = _evaluate_custom(89.4)
    assert s_half_down == 89 and g_half_down == "B"


def test_evidence_audit_deduplication_and_containment(tmp_path: Path):
    """Verifies that evidence auditing deduplicates normalized paths, checks containment, and penalizes missing files."""
    evidence_dir = tmp_path / "evidence"
    evidence_dir.mkdir()

    # Create run_1/completion.png
    run_1_dir = evidence_dir / "run_1"
    run_1_dir.mkdir()
    comp_file = run_1_dir / "completion.png"
    comp_file.write_bytes(b"image_content_12345")

    runs = [
        {
            "id": 1,
            "status": "passed",
            "evidence_paths": ["run_1/completion.png", "run_1/completion.png"],  # Duplicate path
        },
        {
            "id": 2,
            "status": "passed",  # Expects run_2/completion.png which doesn't exist
            "evidence_paths": [],
        },
        {
            "id": 3,
            "status": "failed",
            "evidence_paths": ["../outside_escape.png"],  # Path traversal attempt
            "action_results": [{"action_type": "click", "status": "failed"}],
        },
    ]

    audit = audit_evidence(runs=runs, defects=[], evidence_root=evidence_dir)

    # run_1/completion.png: verified
    # run_2/completion.png: missing
    # ../outside_escape.png: missing (blocked by containment)
    assert audit["verified_artifacts_count"] == 1
    assert audit["missing_artifacts_count"] == 2
    assert audit["audit_deduction"] == 10.0  # 2 missing * 5.0
    assert "run_2/completion.png" in audit["missing_artifacts_paths"]


def test_generate_and_verify_certificate_self_contained(tmp_path: Path):
    """Verifies generating a full certificate and performing self-contained verification."""
    evidence_dir = tmp_path / "evidence"
    evidence_dir.mkdir()
    run_1_dir = evidence_dir / "run_1"
    run_1_dir.mkdir()
    (run_1_dir / "completion.png").write_bytes(b"screenshot_bytes")

    app = {"id": 1, "name": "Test Store", "url": "http://127.0.0.1:8000"}
    runs = [
        {
            "id": 1,
            "status": "passed",
            "action_results": [
                {"action_type": "navigate", "status": "passed"},
                {"action_type": "assert_text_visible", "status": "passed"},
            ],
            "evidence_paths": ["run_1/completion.png"],
        }
    ]
    defects = []

    cert = generate_certificate_payload(
        target_app=app,
        runs=runs,
        defects=defects,
        certificate_id="cert_abc_123",
        evidence_root=evidence_dir,
    )

    assert cert["scoring_policy_version"] == SCORING_POLICY_VERSION
    assert cert["score_summary"]["score"] == 100
    assert cert["score_summary"]["grade"] == "A"
    assert "tamper_hash" in cert

    # Mode 1 verification: Self-contained
    v_res = verify_certificate_self_contained(cert)
    assert v_res["math_valid"] is True
    assert v_res["checksum_valid"] is True
    assert v_res["issuer_verified"] is False
    assert v_res["system_matched"] is False

    # Tampering test: Modify score without changing hash
    tampered_cert = dict(cert)
    tampered_cert["score_summary"] = dict(cert["score_summary"])
    tampered_cert["score_summary"]["score"] = 60
    t_res = verify_certificate_self_contained(tampered_cert)
    assert t_res["math_valid"] is False
    assert t_res["checksum_valid"] is False

    # Tampering test: Recompute hash over invalid score
    tampered_cert["tamper_hash"] = compute_integrity_hash(tampered_cert)
    t_res_2 = verify_certificate_self_contained(tampered_cert)
    assert t_res_2["checksum_valid"] is True
    assert t_res_2["math_valid"] is False  # Caught by math verification!
