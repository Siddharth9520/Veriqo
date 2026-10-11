"""Show Me Mode and Fix Prompt Export services."""

from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.defect import Defect
from app.models.replay_attempt import ReplayAttempt
from app.models.test_run import TestRun
from app.schemas.fix_prompt import (
    FixPromptEnvironmentContext,
    FixPromptEvidenceReference,
    FixPromptResponse,
    FixPromptVerificationContext,
)
from app.schemas.show_me import (
    BlindReplayAttemptSummary,
    BlindReplaySummaryRead,
    DiagnosticExplanationRead,
    EvidenceArtifactRead,
    EvidenceSummaryRead,
    ShowMeResponse,
    TestRunContextRead,
)


# ---------------------------------------------------------------------------
# Secret Redaction
# ---------------------------------------------------------------------------

SENSITIVE_KEY_NAMES = {
    "password", "passwd", "secret", "token", "auth", "authorization",
    "api_key", "apikey", "access_token", "refresh_token", "private_key",
    "cookie", "session", "credential", "credentials",
}


def redact_sensitive_text(text: Optional[str]) -> Optional[str]:
    """Scrubs common credentials, tokens, and secrets from arbitrary strings."""
    if not text:
        return text

    # 1. Authorization header: Bearer / Basic
    text = re.sub(
        r"(?i)\b(authorization\s*[:=]\s*(?:bearer|basic)\s+)[a-zA-Z0-9_\-\.+=/]{8,}",
        r"\1[REDACTED]",
        text,
    )

    # 2. Standalone Bearer / Basic tokens
    text = re.sub(
        r"(?i)\b(bearer|basic)\s+[a-zA-Z0-9_\-\.+=/]{8,}",
        r"\1 [REDACTED]",
        text,
    )

    # 3. Key-value / JSON pairs for sensitive keys
    sensitive_key_pattern = (
        r"(?i)([\"']?(?:[a-zA-Z0-9_\-]*?(?:password|passwd|secret|api[-_]?key|access[-_]?token|"
        r"refresh[-_]?token|private[-_]?key|auth(?:orization)?|credential(?:s)?|token)[a-zA-Z0-9_\-]*?)[\"']?"
        r"\s*[:=]\s*[\"']?)([^\"'\s&,;}{]+)([\"']?)"
    )

    def _repl(m: re.Match) -> str:
        prefix, val, suffix = m.group(1), m.group(2), m.group(3)
        if val.upper() in ("[REDACTED]", "[REDACTED_PRIVATE_KEY]", "BEARER", "BASIC"):
            return m.group(0)
        return f"{prefix}[REDACTED]{suffix}"

    text = re.sub(sensitive_key_pattern, _repl, text)

    # 4. URL credentials: http://user:password@host
    text = re.sub(
        r"(https?://[^:/@\s]+):([^/@\s]+)@",
        r"\1:[REDACTED]@",
        text,
    )

    # 5. PEM private keys
    text = re.sub(
        r"-----BEGIN [A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END [A-Z\s]+PRIVATE KEY-----",
        "[REDACTED_PRIVATE_KEY]",
        text,
    )

    return text


def redact_sensitive_dict(data: Any) -> Any:
    """Recursively traverses dicts/lists and redacts values associated with sensitive keys."""
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(sens in k_lower for sens in SENSITIVE_KEY_NAMES):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = redact_sensitive_dict(v)
        return sanitized
    elif isinstance(data, list):
        return [redact_sensitive_dict(item) for item in data]
    elif isinstance(data, str):
        return redact_sensitive_text(data)
    return data


# ---------------------------------------------------------------------------
# Evidence Storage Inspection (Path Traversal Safe)
# ---------------------------------------------------------------------------

def check_artifact_existence(rel_path: str) -> Tuple[bool, Optional[int], str]:
    """Safely checks if an evidence artifact exists on storage disk.

    Returns (exists, file_size_bytes, note).
    """
    evidence_root = Path(settings.EVIDENCE_DIR).resolve()

    try:
        target_path = (evidence_root / rel_path).resolve()
        if not target_path.is_relative_to(evidence_root):
            return False, None, "Access denied: Path traversal blocked"
    except (ValueError, OSError, TypeError):
        return False, None, "Invalid artifact path"

    if not target_path.exists() or not target_path.is_file():
        return False, None, "Artifact missing from storage"

    try:
        size = target_path.stat().st_size
        return True, size, "Artifact verified on storage"
    except OSError:
        return False, None, "Storage read error"


def collect_defect_evidence(
    defect: Defect,
) -> Tuple[List[EvidenceArtifactRead], str]:
    """Gathers and audits all evidence artifacts referenced by run and replays."""
    artifacts: List[EvidenceArtifactRead] = []
    seen_paths = set()

    # 1. Evidence from initial test run
    if defect.test_run and defect.test_run.evidence_paths:
        for p in defect.test_run.evidence_paths:
            if p and p not in seen_paths:
                seen_paths.add(p)
                exists, size, note = check_artifact_existence(p)
                try:
                    filename = Path(p).name
                    dl_url = (
                        f"/api/v1/test-runs/{defect.test_run.id}/evidence/{filename}"
                        if exists
                        else None
                    )
                except Exception:
                    dl_url = None

                artifacts.append(
                    EvidenceArtifactRead(
                        path=p,
                        source="initial_test_run",
                        exists=exists,
                        file_size_bytes=size,
                        download_url=dl_url,
                        note=note,
                    )
                )

    # 2. Evidence from BlindReplay attempts
    for replay in defect.replays:
        if replay.evidence_paths:
            for p in replay.evidence_paths:
                if p and p not in seen_paths:
                    seen_paths.add(p)
                    exists, size, note = check_artifact_existence(p)
                    try:
                        filename = Path(p).name
                        dl_url = (
                            f"/api/v1/replays/{replay.id}/evidence/{filename}"
                            if exists
                            else None
                        )
                    except Exception:
                        dl_url = None

                    artifacts.append(
                        EvidenceArtifactRead(
                            path=p,
                            source="blind_replay",
                            exists=exists,
                            file_size_bytes=size,
                            download_url=dl_url,
                            note=note,
                        )
                    )

    if not artifacts:
        evidence_status = "NONE_RECORDED"
    else:
        verified_count = sum(1 for a in artifacts if a.exists)
        if verified_count == len(artifacts):
            evidence_status = "COMPLETE"
        elif verified_count > 0:
            evidence_status = "PARTIAL"
        else:
            evidence_status = "MISSING"

    return artifacts, evidence_status


# ---------------------------------------------------------------------------
# Show Me Mode Generator
# ---------------------------------------------------------------------------

def generate_show_me_report(defect: Defect, db: Session) -> ShowMeResponse:
    """Generates a complete Show Me diagnostic report for a defect."""
    test_run: Optional[TestRun] = defect.test_run

    # Contextual run info
    run_context: Optional[TestRunContextRead] = None
    if test_run:
        target_app = test_run.target_app
        journey_name = None
        if test_run.journey_definition and isinstance(test_run.journey_definition, dict):
            journey_name = test_run.journey_definition.get("journey_name") or test_run.journey_definition.get("name")

        run_context = TestRunContextRead(
            id=test_run.id,
            target_app_id=test_run.target_app_id,
            target_app_name=target_app.name if target_app else "Unknown App",
            target_app_url=redact_sensitive_text(target_app.url) if target_app else "",
            status=test_run.status,
            journey_name=journey_name,
            started_at=test_run.started_at,
            completed_at=test_run.completed_at,
        )

    # Audit evidence
    artifacts, evidence_status = collect_defect_evidence(defect)
    verified_count = sum(1 for a in artifacts if a.exists)
    missing_count = len(artifacts) - verified_count

    # Extract clean execution logs
    execution_logs: List[Dict[str, Any]] = []
    if test_run and test_run.action_results:
        for idx, res in enumerate(test_run.action_results):
            if isinstance(res, dict):
                clean_entry = {
                    "step_index": idx,
                    "action_type": res.get("action_type"),
                    "status": res.get("status"),
                    "error_message": redact_sensitive_text(res.get("error_message") or res.get("error")),
                    "screenshot_path": res.get("screenshot_path"),
                }
                execution_logs.append(clean_entry)

    evidence_summary = EvidenceSummaryRead(
        status=evidence_status,
        total_artifacts=len(artifacts),
        verified_count=verified_count,
        missing_count=missing_count,
        artifacts=artifacts,
        execution_logs=execution_logs,
    )

    # BlindReplay summary
    replays_sorted: List[ReplayAttempt] = sorted(
        defect.replays, key=lambda r: r.id
    )
    attempts_summaries = [
        BlindReplayAttemptSummary(
            replay_id=r.id,
            status=r.status,
            outcome=r.outcome,
            started_at=r.started_at,
            completed_at=r.completed_at,
            evidence_count=len(r.evidence_paths or []),
            error_message=redact_sensitive_text(r.error_message),
        )
        for r in replays_sorted
    ]

    latest_outcome = replays_sorted[-1].outcome if replays_sorted else None
    has_confirmed = any(r.outcome == "CONFIRMED" for r in replays_sorted)
    is_verified = (defect.status == "VERIFIED") or has_confirmed

    blind_replay_summary = BlindReplaySummaryRead(
        replays_count=len(replays_sorted),
        latest_outcome=latest_outcome,
        is_verified=is_verified,
        attempts=attempts_summaries,
    )

    # Observed actual behavior
    actual_behavior = None
    if test_run and test_run.error_message:
        actual_behavior = redact_sensitive_text(test_run.error_message)
    elif execution_logs:
        failed_steps = [log for log in execution_logs if log.get("status") == "failed"]
        if failed_steps and failed_steps[0].get("error_message"):
            actual_behavior = failed_steps[0]["error_message"]

    if not actual_behavior:
        actual_behavior = "Failure observed during execution run (see description)."

    # Factual diagnostic explanation (strictly separated from proof)
    if is_verified:
        diag_summary = (
            f"Defect '{defect.title}' was independently CONFIRMED by BlindReplay. "
            f"Expected behavior '{defect.expected_behavior or 'N/A'}' was demonstrated to fail."
        )
        confidence = "HIGH"
    elif replays_sorted:
        diag_summary = (
            f"Defect '{defect.title}' was tested via BlindReplay with latest outcome: {latest_outcome}. "
            f"Independent reproduction is not confirmed."
        )
        confidence = "MEDIUM"
    else:
        diag_summary = (
            f"Defect '{defect.title}' was logged from test run #{test_run.id if test_run else 'N/A'}. "
            "No independent BlindReplay attempts have been executed yet."
        )
        confidence = "MEDIUM" if evidence_status in ("COMPLETE", "PARTIAL") else "LOW"

    explanation = DiagnosticExplanationRead(
        summary=diag_summary,
        confidence=confidence,
        is_ai_generated=False,
    )

    return ShowMeResponse(
        defect_id=defect.id,
        title=redact_sensitive_text(defect.title) or "",
        severity=defect.severity,
        status=defect.status,
        description=redact_sensitive_text(defect.description) or "",
        reproduction_steps=redact_sensitive_text(defect.reproduction_steps),
        expected_behavior=redact_sensitive_text(defect.expected_behavior),
        actual_behavior=actual_behavior,
        created_at=defect.created_at,
        test_run=run_context,
        evidence=evidence_summary,
        blind_replay=blind_replay_summary,
        explanation=explanation,
    )


# ---------------------------------------------------------------------------
# Fix Prompt Export Generator
# ---------------------------------------------------------------------------

def generate_fix_prompt_export(defect: Defect, db: Session) -> FixPromptResponse:
    """Builds a developer-ready, structured fix prompt for a defect."""
    test_run: Optional[TestRun] = defect.test_run
    target_app = test_run.target_app if test_run else None

    # Context
    app_name = target_app.name if target_app else "Unknown Application"
    app_url = redact_sensitive_text(target_app.url) if target_app else "Unavailable"
    run_id_val = test_run.id if test_run else 0
    run_status_val = test_run.status if test_run else "unknown"
    journey_name_val = None
    if test_run and test_run.journey_definition and isinstance(test_run.journey_definition, dict):
        journey_name_val = test_run.journey_definition.get("journey_name") or test_run.journey_definition.get("name")

    env_context = FixPromptEnvironmentContext(
        target_app_name=app_name,
        target_app_url=app_url,
        test_run_id=run_id_val,
        test_run_status=run_status_val,
        journey_name=journey_name_val,
    )

    # BlindReplay verification context
    replays_sorted: List[ReplayAttempt] = sorted(
        defect.replays, key=lambda r: r.id
    )
    latest_outcome = replays_sorted[-1].outcome if replays_sorted else None
    has_confirmed = any(r.outcome == "CONFIRMED" for r in replays_sorted)
    is_verified = (defect.status == "VERIFIED") or has_confirmed

    if is_verified:
        verif_notes = (
            "Verified Fact: Independently reproduced and confirmed by BlindReplay "
            "in an isolated browser session without shared state or cookies."
        )
    elif latest_outcome:
        verif_notes = (
            f"Unverified Finding: BlindReplay executed with outcome '{latest_outcome}'. "
            "Defect is not independently confirmed."
        )
    else:
        verif_notes = (
            "Unverified Finding: No automated BlindReplay verification attempt on record. "
            "Rely strictly on initial run logs."
        )

    verif_context = FixPromptVerificationContext(
        replays_count=len(replays_sorted),
        latest_outcome=latest_outcome,
        is_verified=is_verified,
        verification_notes=verif_notes,
    )

    # Collect evidence references
    artifacts, _ = collect_defect_evidence(defect)
    evidence_refs: List[FixPromptEvidenceReference] = [
        FixPromptEvidenceReference(
            path=a.path,
            source=a.source,
            exists=a.exists,
            note=a.note,
        )
        for a in artifacts
    ]

    # Clean text values
    clean_title = redact_sensitive_text(defect.title) or ""
    clean_desc = redact_sensitive_text(defect.description) or ""
    clean_repro = redact_sensitive_text(defect.reproduction_steps)
    clean_expected = redact_sensitive_text(defect.expected_behavior)

    # Determine actual behavior
    actual_behavior = None
    if test_run and test_run.error_message:
        actual_behavior = redact_sensitive_text(test_run.error_message)
    elif test_run and test_run.action_results:
        for act in test_run.action_results:
            err = act.get("error_message") or act.get("error") if isinstance(act, dict) else None
            if isinstance(act, dict) and act.get("status") == "failed" and err:
                actual_behavior = redact_sensitive_text(err)
                break

    if not actual_behavior:
        actual_behavior = "Observed failure matching defect description during test execution."

    developer_tasks = [
        "Investigate the root cause in the affected application and endpoint/UI logic.",
        "Propose a minimal, targeted code fix without altering unrelated application behavior.",
        "Add an automated regression test exercising the reproduction steps.",
        "Ensure all existing contracts and validation boundaries remain intact.",
    ]

    # Generate Markdown prompt text
    evidence_lines = []
    if evidence_refs:
        for ref in evidence_refs:
            status_tag = "verified on disk" if ref.exists else "MISSING from disk"
            evidence_lines.append(f"- `{ref.path}` ({ref.source}, {status_tag})")
    else:
        evidence_lines.append("- *No evidence artifacts captured or recorded.*")

    evidence_block = "\n".join(evidence_lines)
    repro_block = clean_repro if clean_repro else "*[No reproduction steps provided]*"
    expected_block = clean_expected if clean_expected else "*[No expected behavior provided]*"
    journey_display = f" (`{journey_name_val}`)" if journey_name_val else ""

    markdown_prompt = f"""# Bug Fix Request: {clean_title}

## Overview & Metadata
- **Defect ID**: #{defect.id}
- **Severity**: {defect.severity}
- **Status**: {defect.status}
- **Target Application**: {app_name} ({app_url})
- **Encountered in Test Run**: #{run_id_val}{journey_display} (Status: {run_status_val})

---

## Verified Facts & Observed Context
### Description
{clean_desc}

### Reproduction Steps
{repro_block}

### Expected Behavior
{expected_block}

### Actual Observed Behavior
{actual_behavior}

---

## Verification & Trust Boundary
- **BlindReplay Outcome**: {latest_outcome if latest_outcome else "NOT_ATTEMPTED"}
- **Verification Status**: {"VERIFIED (Independently Confirmed)" if is_verified else "UNVERIFIED"}
- **Trust Note**: {verif_notes}

---

## Evidence Artifacts
{evidence_block}

---

## Developer Instructions
1. Investigate the root cause of the defect described above.
2. Formulate a minimal, focused correction that resolves the issue safely.
3. Add a dedicated regression test reproducing this exact scenario.
4. Verify that existing API contracts, database integrity, and test suites continue to pass.
"""

    return FixPromptResponse(
        defect_id=defect.id,
        prompt_text=markdown_prompt.strip(),
        title=clean_title,
        severity=defect.severity,
        status=defect.status,
        description=clean_desc,
        reproduction_steps=clean_repro,
        expected_behavior=clean_expected,
        actual_behavior=actual_behavior,
        environment_context=env_context,
        verification_context=verif_context,
        evidence_references=evidence_refs,
        developer_tasks=developer_tasks,
        generated_at=datetime.now(timezone.utc),
    )
