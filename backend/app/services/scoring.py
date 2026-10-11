"""Deterministic QA Scoring and Certificate Integrity Service.

Implements pure scoring algorithms, defect deduplication, evidence auditing,
deterministic JSON serialization, and SHA-256 integrity checksums for Veriqo QA certificates.
"""

from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from app.core.config import settings

# Explicit scoring policy version
SCORING_POLICY_VERSION: str = "1.0.0"

# Penalty schedule
PENALTY_VERIFIED_CRITICAL: float = 35.0
PENALTY_VERIFIED_HIGH: float = 20.0
PENALTY_VERIFIED_MEDIUM: float = 10.0
PENALTY_VERIFIED_LOW: float = 5.0
NON_VERIFIED_PENALTY_RATIO: float = 0.50

# Caps
CAP_NO_ASSERTIONS: float = 75.0
CAP_VERIFIED_HIGH: float = 65.0
CAP_VERIFIED_CRITICAL: float = 40.0

# Audit deduction
AUDIT_DEDUCTION_PER_MISSING_ARTIFACT: float = 5.0

SEVERITY_RANKS: Dict[str, int] = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}


def normalize_text(text: Optional[str]) -> str:
    """Normalizes text by lowercasing, stripping leading/trailing whitespace, and collapsing internal whitespace."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", str(text).strip().lower())


def _sanitize_for_deterministic_json(obj: Any) -> Any:
    """Recursively converts an object into a canonical JSON-serializable structure.

    - Rejects non-finite numbers (NaN, Inf, -Inf).
    - Rounds floating-point numbers to 4 decimal places.
    - Formats datetimes to ISO 8601 UTC strings with 'Z' suffix.
    - Recursively processes dicts and lists.
    """
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            raise ValueError(f"Non-finite numbers ({obj}) are disallowed in deterministic JSON serialization.")
        return round(obj, 4)
    if isinstance(obj, (int, str, bool)) or obj is None:
        return obj
    if isinstance(obj, datetime):
        if obj.tzinfo is None:
            # Assume UTC if naive
            dt = obj.replace(tzinfo=timezone.utc)
        else:
            dt = obj.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    if isinstance(obj, dict):
        return {str(k): _sanitize_for_deterministic_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_sanitize_for_deterministic_json(v) for v in obj]
    if hasattr(obj, "model_dump"):
        return _sanitize_for_deterministic_json(obj.model_dump(mode="json"))
    if hasattr(obj, "__dict__"):
        return _sanitize_for_deterministic_json(obj.__dict__)
    return str(obj)


def serialize_deterministic(payload: Dict[str, Any]) -> bytes:
    """Serializes a dictionary into deterministic UTF-8 JSON bytes.

    Applies key sorting, compact separators, UTF-8 encoding, float rounding,
    and non-finite number rejection.
    """
    clean_obj = _sanitize_for_deterministic_json(payload)
    json_str = json.dumps(
        clean_obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return json_str.encode("utf-8")


def compute_integrity_hash(payload: Dict[str, Any]) -> str:
    """Computes an unkeyed SHA-256 hash over deterministic JSON serialization, excluding tamper_hash."""
    payload_copy = {k: v for k, v in payload.items() if k != "tamper_hash"}
    canonical_bytes = serialize_deterministic(payload_copy)
    return hashlib.sha256(canonical_bytes).hexdigest()


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    """Safe attribute/key getter supporting dicts, dataclasses, and ORM models."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _is_assertion_action(action_type: Any) -> bool:
    """Checks whether an action represents a verification assertion."""
    if not action_type:
        return False
    action_str = str(action_type).lower()
    return (
        "assert_text_visible" in action_str
        or "assert_element_visible" in action_str
        or action_str.startswith("assert_")
    )


def audit_evidence(
    runs: Sequence[Any],
    defects: Sequence[Any],
    evidence_root: Optional[Path] = None,
) -> Dict[str, Any]:
    """Audits expected evidence artifacts across runs and replays.

    Deduplicates artifacts by normalized path while preserving all provenance tags and source entities.
    Verifies path containment and disk existence without counting missing files twice.
    """
    root = (evidence_root or Path(settings.EVIDENCE_DIR)).resolve()

    # Map normalized_path -> {provenance: set, source_entities: set, expected_folder: str}
    expected_map: Dict[str, Dict[str, Any]] = {}

    def _add_artifact(rel_path: str, provenance_tag: str, source_entity: str, expected_folder: str):
        if not rel_path:
            return
        # Normalize relative path (forward slashes, stripped)
        clean_path = str(Path(rel_path.strip())).replace("\\", "/")
        if clean_path not in expected_map:
            expected_map[clean_path] = {
                "provenance": set(),
                "source_entities": set(),
                "expected_folder": expected_folder,
            }
        expected_map[clean_path]["provenance"].add(provenance_tag)
        expected_map[clean_path]["source_entities"].add(source_entity)

    # 1. Audit runs
    for run in runs:
        run_id = _get_val(run, "id") or _get_val(run, "run_id")
        run_status = (_get_val(run, "status") or "").lower()
        run_folder = f"run_{run_id}"

        if run_status == "passed":
            # Contract: passed run captures completion screenshot
            _add_artifact(
                rel_path=f"run_{run_id}/completion.png",
                provenance_tag="run_completion",
                source_entity=f"test_run:{run_id}",
                expected_folder=run_folder,
            )
        elif run_status == "failed":
            # Contract: runner logs failure screenshot if taken inside browser
            paths = _get_val(run, "evidence_paths") or []
            if paths:
                for p in paths:
                    _add_artifact(
                        rel_path=p,
                        provenance_tag="run_failure",
                        source_entity=f"test_run:{run_id}",
                        expected_folder=run_folder,
                    )
            else:
                # If runner didn't log paths, check if failure occurred during an action step
                action_results = _get_val(run, "action_results") or []
                failed_idx = None
                for idx, res in enumerate(action_results):
                    if _get_val(res, "status") == "failed":
                        failed_idx = idx
                        break
                if failed_idx is not None:
                    _add_artifact(
                        rel_path=f"run_{run_id}/failure_step_{failed_idx}.png",
                        provenance_tag="run_failure",
                        source_entity=f"test_run:{run_id}",
                        expected_folder=run_folder,
                    )
        elif run_status == "timed_out":
            paths = _get_val(run, "evidence_paths") or []
            for p in paths:
                _add_artifact(
                    rel_path=p,
                    provenance_tag="run_timeout",
                    source_entity=f"test_run:{run_id}",
                    expected_folder=run_folder,
                )

    # 2. Audit replays associated with defects
    for defect in defects:
        replays = _get_val(defect, "replays") or []
        for replay in replays:
            replay_id = _get_val(replay, "id") or _get_val(replay, "replay_id")
            replay_folder = f"replay_{replay_id}"
            paths = _get_val(replay, "evidence_paths") or []
            for p in paths:
                _add_artifact(
                    rel_path=p,
                    provenance_tag="replay_outcome",
                    source_entity=f"replay_attempt:{replay_id}",
                    expected_folder=replay_folder,
                )

    # 3. Check physical existence and containment
    artifacts_report: List[Dict[str, Any]] = []
    missing_paths: List[str] = []
    verified_count = 0

    for norm_path, meta in sorted(expected_map.items(), key=lambda x: x[0]):
        expected_folder = meta["expected_folder"]
        allowed_parent = (root / expected_folder).resolve()

        target_file = (root / norm_path).resolve()
        is_verified = False
        file_size = None

        # Check strict directory containment
        try:
            if target_file.is_relative_to(allowed_parent):
                if target_file.exists() and target_file.is_file():
                    size = target_file.stat().st_size
                    if size > 0:
                        is_verified = True
                        file_size = size
        except (ValueError, OSError):
            is_verified = False

        if is_verified:
            verified_count += 1
        else:
            missing_paths.append(norm_path)

        artifacts_report.append(
            {
                "path": norm_path,
                "provenance": sorted(list(meta["provenance"])),
                "source_entities": sorted(list(meta["source_entities"])),
                "verified": is_verified,
                "file_size_bytes": file_size,
            }
        )

    expected_count = len(artifacts_report)
    missing_count = len(missing_paths)
    audit_deduction = round(AUDIT_DEDUCTION_PER_MISSING_ARTIFACT * missing_count, 2)

    return {
        "expected_artifacts_count": expected_count,
        "verified_artifacts_count": verified_count,
        "missing_artifacts_count": missing_count,
        "missing_artifacts_paths": missing_paths,
        "audit_deduction": audit_deduction,
        "artifacts": artifacts_report,
    }


def deduplicate_defects(defects: Sequence[Any]) -> List[Dict[str, Any]]:
    """Deduplicates defect records by normalized (title, reproduction_steps).

    Preserves all original defect IDs and replay histories.
    A finding is VERIFIED if and only if at least one replay produced explicit 'CONFIRMED'.
    """
    groups: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for defect in defects:
        defect_id = _get_val(defect, "id") or _get_val(defect, "defect_id")
        title_raw = _get_val(defect, "title") or ""
        steps_raw = _get_val(defect, "reproduction_steps") or ""
        sev_raw = (_get_val(defect, "severity") or "MEDIUM").upper()

        key = (normalize_text(title_raw), normalize_text(steps_raw))

        if key not in groups:
            groups[key] = {
                "finding_key": key[0],
                "title": title_raw.strip(),
                "severities": [],
                "source_defect_ids": set(),
                "replay_history": [],
                "has_confirmed_replay": False,
                "confirmed_evidence_path": None,
            }

        group = groups[key]
        if defect_id is not None:
            group["source_defect_ids"].add(defect_id)
        group["severities"].append(sev_raw)

        # Inspect replay attempts for this defect
        replays = _get_val(defect, "replays") or []
        for rep in replays:
            rep_id = _get_val(rep, "id") or _get_val(rep, "replay_id")
            outcome = (_get_val(rep, "outcome") or "").upper()
            paths = _get_val(rep, "evidence_paths") or []
            ev_path = paths[0] if paths else None

            group["replay_history"].append(
                {
                    "replay_id": rep_id,
                    "defect_id": defect_id,
                    "outcome": outcome,
                    "evidence_path": ev_path,
                }
            )

            if outcome == "CONFIRMED":
                group["has_confirmed_replay"] = True
                if not group["confirmed_evidence_path"] and ev_path:
                    group["confirmed_evidence_path"] = ev_path

    findings: List[Dict[str, Any]] = []
    for key, group in sorted(groups.items(), key=lambda x: x[0][0]):
        # Resolve highest severity in group
        best_sev = "MEDIUM"
        highest_rank = -1
        for s in group["severities"]:
            rank = SEVERITY_RANKS.get(s, 2)
            if rank > highest_rank:
                highest_rank = rank
                best_sev = s

        is_verified = group["has_confirmed_replay"]

        # Exact penalty calculation
        if best_sev == "CRITICAL":
            base_pen = PENALTY_VERIFIED_CRITICAL
        elif best_sev == "HIGH":
            base_pen = PENALTY_VERIFIED_HIGH
        elif best_sev == "MEDIUM":
            base_pen = PENALTY_VERIFIED_MEDIUM
        else:
            base_pen = PENALTY_VERIFIED_LOW

        penalty = base_pen if is_verified else (base_pen * NON_VERIFIED_PENALTY_RATIO)

        # Sort replay history deterministically by replay_id
        sorted_replays = sorted(group["replay_history"], key=lambda r: (r.get("replay_id") or 0))

        findings.append(
            {
                "finding_key": group["finding_key"],
                "title": group["title"],
                "severity": best_sev,
                "is_verified": is_verified,
                "penalty_applied": round(penalty, 2),
                "source_defect_ids": sorted(list(group["source_defect_ids"])),
                "replay_history": sorted_replays,
                "confirmed_evidence_path": group["confirmed_evidence_path"],
            }
        )

    return findings


def calculate_qa_score(
    runs: Sequence[Any],
    defects: Sequence[Any],
    audit_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Pure functional deterministic QA scoring calculation.

    Returns ScoreSummary, evaluation metrics, findings, and applied caps.
    Returns status='UNTESTED' with score=None, grade=None if runs is empty.
    """
    eligible_runs: List[Dict[str, Any]] = []

    # 1. Process runs and assertion accounting
    total_actions_evaluated = 0
    total_assertions_evaluated = 0
    passed_assertions_count = 0
    failed_assertions_count = 0
    passed_runs_count = 0
    failed_runs_count = 0
    timed_out_runs_count = 0

    for run in runs:
        run_id = _get_val(run, "id") or _get_val(run, "run_id")
        run_status = (_get_val(run, "status") or "").lower()

        if run_status == "passed":
            passed_runs_count += 1
        elif run_status == "timed_out":
            timed_out_runs_count += 1
        else:
            failed_runs_count += 1

        action_results = _get_val(run, "action_results") or []
        run_actions = len(action_results)
        run_asserts_eval = 0
        run_asserts_pass = 0
        run_asserts_fail = 0

        for res in action_results:
            a_type = _get_val(res, "action_type")
            a_status = (_get_val(res, "status") or "").lower()

            if _is_assertion_action(a_type):
                run_asserts_eval += 1
                if a_status == "passed":
                    run_asserts_pass += 1
                else:
                    run_asserts_fail += 1

        total_actions_evaluated += run_actions
        total_assertions_evaluated += run_asserts_eval
        passed_assertions_count += run_asserts_pass
        failed_assertions_count += run_asserts_fail

        eligible_runs.append(
            {
                "run_id": run_id,
                "status": run_status,
                "actions_evaluated": run_actions,
                "assertions_evaluated": run_asserts_eval,
                "assertions_passed": run_asserts_pass,
                "assertions_failed": run_asserts_fail,
            }
        )

    eligible_count = len(eligible_runs)

    # UNTESTED check
    if eligible_count == 0:
        return {
            "status": "UNTESTED",
            "score": None,
            "grade": None,
            "base_score": None,
            "raw_score": None,
            "penalties": {
                "verified_defects_deduction": 0.0,
                "unverified_defects_deduction": 0.0,
                "audit_deduction": 0.0,
            },
            "caps_applied": [],
            "evaluation_scope": {
                "test_run_ids": [],
                "eligible_runs_count": 0,
                "passed_runs_count": 0,
                "failed_runs_count": 0,
                "timed_out_runs_count": 0,
                "journey_pass_rate": 0.0,
                "total_actions_evaluated": 0,
                "total_assertions_evaluated": 0,
                "passed_assertions_count": 0,
                "failed_assertions_count": 0,
                "assertion_pass_rate": None,
                "runs": [],
            },
            "findings": [],
        }

    # 2. Ratios
    journey_pass_rate = passed_runs_count / eligible_count

    if total_assertions_evaluated > 0:
        assertion_pass_rate = passed_assertions_count / total_assertions_evaluated
        base_score = (50.0 * journey_pass_rate) + (50.0 * assertion_pass_rate)
    else:
        assertion_pass_rate = None
        base_score = 100.0 * journey_pass_rate

    # 3. Deductions
    findings = deduplicate_defects(defects)

    verified_deduction = 0.0
    unverified_deduction = 0.0
    has_verified_high = False
    has_verified_critical = False

    for f in findings:
        pen = f["penalty_applied"]
        if f["is_verified"]:
            verified_deduction += pen
            if f["severity"] == "HIGH":
                has_verified_high = True
            elif f["severity"] == "CRITICAL":
                has_verified_critical = True
        else:
            unverified_deduction += pen

    total_defect_deduction = verified_deduction + unverified_deduction

    audit_deduction = 0.0
    if audit_result:
        audit_deduction = float(audit_result.get("audit_deduction", 0.0))

    raw_score = base_score - total_defect_deduction - audit_deduction

    # 4. Caps
    caps_applied: List[str] = []
    capped_score = raw_score

    if total_assertions_evaluated == 0:
        if capped_score > CAP_NO_ASSERTIONS:
            capped_score = CAP_NO_ASSERTIONS
        caps_applied.append("NO_ASSERTIONS_EVALUATED_CAP_75")

    if has_verified_high:
        if capped_score > CAP_VERIFIED_HIGH:
            capped_score = CAP_VERIFIED_HIGH
        caps_applied.append("VERIFIED_HIGH_DEFECT_CAP_65")

    if has_verified_critical:
        if capped_score > CAP_VERIFIED_CRITICAL:
            capped_score = CAP_VERIFIED_CRITICAL
        caps_applied.append("VERIFIED_CRITICAL_DEFECT_CAP_40")

    # 5. Clamping and Final Half-Up Rounding
    clamped_score = max(0.0, min(100.0, capped_score))
    final_score = int(math.floor(clamped_score + 0.5))

    # 6. Pure Numeric Grade Boundaries
    if final_score >= 90:
        grade = "A"
    elif final_score >= 80:
        grade = "B"
    elif final_score >= 70:
        grade = "C"
    elif final_score >= 60:
        grade = "D"
    else:
        grade = "F"

    test_run_ids = [r["run_id"] for r in eligible_runs if r["run_id"] is not None]

    return {
        "status": "ISSUED",
        "score": final_score,
        "grade": grade,
        "base_score": round(base_score, 4),
        "raw_score": round(raw_score, 4),
        "penalties": {
            "verified_defects_deduction": round(verified_deduction, 2),
            "unverified_defects_deduction": round(unverified_deduction, 2),
            "audit_deduction": round(audit_deduction, 2),
        },
        "caps_applied": caps_applied,
        "evaluation_scope": {
            "test_run_ids": test_run_ids,
            "eligible_runs_count": eligible_count,
            "passed_runs_count": passed_runs_count,
            "failed_runs_count": failed_runs_count,
            "timed_out_runs_count": timed_out_runs_count,
            "journey_pass_rate": round(journey_pass_rate, 4),
            "total_actions_evaluated": total_actions_evaluated,
            "total_assertions_evaluated": total_assertions_evaluated,
            "passed_assertions_count": passed_assertions_count,
            "failed_assertions_count": failed_assertions_count,
            "assertion_pass_rate": round(assertion_pass_rate, 4) if assertion_pass_rate is not None else None,
            "runs": eligible_runs,
        },
        "findings": findings,
    }


def generate_certificate_payload(
    target_app: Any,
    runs: Sequence[Any],
    defects: Sequence[Any],
    certificate_id: str,
    evidence_root: Optional[Path] = None,
    issued_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Generates a complete, reproducible, and verifiable QA Certificate payload."""
    audit_res = audit_evidence(runs=runs, defects=defects, evidence_root=evidence_root)
    score_res = calculate_qa_score(runs=runs, defects=defects, audit_result=audit_res)

    app_id = _get_val(target_app, "id") or _get_val(target_app, "app_id")
    app_name = _get_val(target_app, "name") or "Target App"
    app_url = _get_val(target_app, "url") or ""

    now_dt = issued_at or datetime.now(timezone.utc)
    if now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=timezone.utc)

    payload: Dict[str, Any] = {
        "certificate_id": certificate_id,
        "status": score_res["status"],
        "scoring_policy_version": SCORING_POLICY_VERSION,
        "issued_at": now_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "target_app": {
            "id": app_id,
            "name": app_name,
            "url": app_url,
        },
        "evaluation_scope": score_res["evaluation_scope"],
        "findings": score_res["findings"],
        "evidence_audit": audit_res,
        "score_summary": {
            "score": score_res["score"],
            "grade": score_res["grade"],
            "base_score": score_res["base_score"],
            "raw_score": score_res["raw_score"],
            "penalties": score_res["penalties"],
            "caps_applied": score_res["caps_applied"],
        },
        "limitations": [
            "This certificate reflects ONLY the results of the specific automated journeys and assertions executed during the evaluated test runs.",
            "This certificate does NOT certify that the application is bug-free, error-free, secure, or compliant with requirements outside the executed journeys.",
            "Grades (A, B, C, D, F) represent pure numerical score bands and do not independently certify overall software quality or release readiness.",
            "The tamper_hash is an unkeyed SHA-256 integrity checksum against accidental payload modification. It does NOT prove issuer identity or non-repudiation.",
        ],
    }

    # Compute and attach tamper_hash
    tamper_hash = compute_integrity_hash(payload)
    payload["tamper_hash"] = tamper_hash
    return payload


def verify_certificate_self_contained(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Verifies a certificate payload using only its self-contained immutable inputs.

    Performs:
    1. Policy version validation.
    2. Checksum validation (SHA-256 over deterministic JSON).
    3. Mathematical recalculation of score, penalties, caps, and grade from raw inputs.

    Note: Always returns issuer_verified=False and system_matched=False as unkeyed
    checksums do not authenticate public issuer identity.
    """
    if not isinstance(payload, dict):
        return {
            "math_valid": False,
            "checksum_valid": False,
            "system_matched": False,
            "issuer_verified": False,
            "error": "Payload must be a dictionary.",
        }

    # 1. Validate policy version
    policy_ver = payload.get("scoring_policy_version")
    if policy_ver != SCORING_POLICY_VERSION:
        return {
            "math_valid": False,
            "checksum_valid": False,
            "system_matched": False,
            "issuer_verified": False,
            "error": f"Unsupported scoring policy version '{policy_ver}'. Expected '{SCORING_POLICY_VERSION}'.",
        }

    # 2. Checksum check
    embedded_hash = payload.get("tamper_hash")
    if not embedded_hash:
        checksum_valid = False
    else:
        try:
            recomputed_hash = compute_integrity_hash(payload)
            checksum_valid = (recomputed_hash == embedded_hash)
        except Exception:
            checksum_valid = False

    # 3. Mathematical recalculation check
    scope = payload.get("evaluation_scope") or {}
    findings = payload.get("findings") or []
    audit = payload.get("evidence_audit") or {}
    summary = payload.get("score_summary") or {}

    try:
        runs = scope.get("runs") or []
        eligible_count = len(runs)

        if eligible_count == 0:
            math_valid = (
                payload.get("status") == "UNTESTED"
                and summary.get("score") is None
                and summary.get("grade") is None
            )
        else:
            passed_runs = sum(1 for r in runs if r.get("status") == "passed")
            total_asserts = sum(r.get("assertions_evaluated", 0) for r in runs)
            passed_asserts = sum(r.get("assertions_passed", 0) for r in runs)

            j_rate = passed_runs / eligible_count
            if total_asserts > 0:
                a_rate = passed_asserts / total_asserts
                base = (50.0 * j_rate) + (50.0 * a_rate)
            else:
                base = 100.0 * j_rate

            ver_ded = 0.0
            unver_ded = 0.0
            has_high = False
            has_crit = False

            for f in findings:
                sev = f.get("severity", "MEDIUM")
                is_v = bool(f.get("is_verified"))
                if sev == "CRITICAL":
                    b_pen = PENALTY_VERIFIED_CRITICAL
                elif sev == "HIGH":
                    b_pen = PENALTY_VERIFIED_HIGH
                elif sev == "MEDIUM":
                    b_pen = PENALTY_VERIFIED_MEDIUM
                else:
                    b_pen = PENALTY_VERIFIED_LOW

                pen = b_pen if is_v else (b_pen * NON_VERIFIED_PENALTY_RATIO)
                if is_v:
                    ver_ded += pen
                    if sev == "HIGH":
                        has_high = True
                    elif sev == "CRITICAL":
                        has_crit = True
                else:
                    unver_ded += pen

            audit_ded = float(audit.get("audit_deduction", 0.0))
            raw = base - (ver_ded + unver_ded) - audit_ded
            capped = raw

            if total_asserts == 0 and capped > CAP_NO_ASSERTIONS:
                capped = CAP_NO_ASSERTIONS
            if has_high and capped > CAP_VERIFIED_HIGH:
                capped = CAP_VERIFIED_HIGH
            if has_crit and capped > CAP_VERIFIED_CRITICAL:
                capped = CAP_VERIFIED_CRITICAL

            recalc_score = int(math.floor(max(0.0, min(100.0, capped)) + 0.5))

            if recalc_score >= 90:
                recalc_grade = "A"
            elif recalc_score >= 80:
                recalc_grade = "B"
            elif recalc_score >= 70:
                recalc_grade = "C"
            elif recalc_score >= 60:
                recalc_grade = "D"
            else:
                recalc_grade = "F"

            math_valid = (
                summary.get("score") == recalc_score
                and summary.get("grade") == recalc_grade
            )

    except Exception as exc:
        return {
            "math_valid": False,
            "checksum_valid": checksum_valid,
            "system_matched": False,
            "issuer_verified": False,
            "error": f"Error during mathematical recalculation: {str(exc)}",
        }

    return {
        "math_valid": math_valid,
        "checksum_valid": checksum_valid,
        "system_matched": False,
        "issuer_verified": False,
        "error": None if (math_valid and checksum_valid) else "Checksum or mathematical inconsistency detected.",
    }
