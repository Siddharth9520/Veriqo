"""Safe demo data reset utility for Veriqo.

Safely purges only disposable demo records (identified by demo name or localhost test origin)
or a specific target application without affecting ordinary user applications or data.
Preserves database file, schema structure, tables, and settings.
"""

import argparse
import sys
from typing import Any, Dict, List, Optional
from sqlalchemy import Engine, text

from app.db.session import engine as default_engine


def reset_demo_data(
    target_app_id: Optional[int] = None,
    demo_only: bool = True,
    db_engine: Optional[Engine] = None,
) -> Dict[str, int]:
    """Safely clears demo data rows while preserving ordinary application records.

    Args:
        target_app_id: If specified, clears only records belonging to this target application.
        demo_only: If True (default), only deletes applications matching demo patterns
                   (e.g., '[Demo]', 'Demo', or '127.0.0.1:8080'). Never touches ordinary user apps.
        db_engine: Optional SQLAlchemy Engine override (useful for testing on isolated DBs).

    Returns:
        A dictionary with deletion counts per entity type.
    """
    engine = db_engine or default_engine
    counts = {
        "certificates": 0,
        "replay_attempts": 0,
        "regression_journeys": 0,
        "defects": 0,
        "test_runs": 0,
        "target_apps": 0,
    }

    with engine.begin() as conn:
        # Determine target application IDs to purge
        if target_app_id is not None:
            app_ids = [target_app_id]
        elif demo_only:
            query = text(
                "SELECT id, name FROM target_apps "
                "WHERE name LIKE '%Demo%' OR name LIKE '%[Demo]%' "
                "   OR url LIKE '%127.0.0.1:8080%' OR url LIKE '%localhost:8080%'"
            )
            rows = conn.execute(query).fetchall()
            app_ids = [row[0] for row in rows]
            if not app_ids:
                print("No disposable demo applications found. All existing user data preserved.")
                return counts
        else:
            # Unrestricted mode: all target apps
            rows = conn.execute(text("SELECT id FROM target_apps")).fetchall()
            app_ids = [row[0] for row in rows]

        if not app_ids:
            return counts

        # Find associated test runs and defects to respect foreign key cascade order
        placeholders = ",".join(str(int(aid)) for aid in app_ids)
        run_rows = conn.execute(
            text(f"SELECT id FROM test_runs WHERE target_app_id IN ({placeholders})")
        ).fetchall()
        run_ids = [row[0] for row in run_rows]

        defect_ids: List[int] = []
        if run_ids:
            run_ph = ",".join(str(int(rid)) for rid in run_ids)
            defect_rows = conn.execute(
                text(f"SELECT id FROM defects WHERE test_run_id IN ({run_ph})")
            ).fetchall()
            defect_ids = [row[0] for row in defect_rows]

        # 1. Delete certificates
        res = conn.execute(text(f"DELETE FROM certificates WHERE target_app_id IN ({placeholders})"))
        counts["certificates"] = res.rowcount if res.rowcount is not None and res.rowcount >= 0 else 0

        # 2. Delete replay attempts
        if defect_ids:
            def_ph = ",".join(str(int(did)) for did in defect_ids)
            res = conn.execute(text(f"DELETE FROM replay_attempts WHERE defect_id IN ({def_ph})"))
            counts["replay_attempts"] = res.rowcount if res.rowcount is not None and res.rowcount >= 0 else 0

        # 3. Delete regression journeys
        res = conn.execute(text(f"DELETE FROM regression_journeys WHERE target_app_id IN ({placeholders})"))
        counts["regression_journeys"] = res.rowcount if res.rowcount is not None and res.rowcount >= 0 else 0

        # 4. Delete defects
        if run_ids:
            run_ph = ",".join(str(int(rid)) for rid in run_ids)
            res = conn.execute(text(f"DELETE FROM defects WHERE test_run_id IN ({run_ph})"))
            counts["defects"] = res.rowcount if res.rowcount is not None and res.rowcount >= 0 else 0

        # 5. Delete test runs
        res = conn.execute(text(f"DELETE FROM test_runs WHERE target_app_id IN ({placeholders})"))
        counts["test_runs"] = res.rowcount if res.rowcount is not None and res.rowcount >= 0 else 0

        # 6. Delete target apps
        res = conn.execute(text(f"DELETE FROM target_apps WHERE id IN ({placeholders})"))
        counts["target_apps"] = res.rowcount if res.rowcount is not None and res.rowcount >= 0 else 0

    print("Demo data reset completed safely:")
    for entity, count in counts.items():
        print(f"  - {entity}: {count} rows deleted")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Safe demo data reset utility for Veriqo. Preserves ordinary user data by default."
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required confirmation flag to proceed with reset.",
    )
    parser.add_argument(
        "--app-id",
        type=int,
        default=None,
        help="Reset only a specific target application and its associated records.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Target all applications (destructive). Requires --force.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Explicit confirmation required when resetting all applications.",
    )

    args = parser.parse_args()

    if not args.confirm:
        print("Safety protection: The --confirm flag is required.")
        print("Usage:")
        print("  python -m app.reset_demo --confirm               # Safely clears demo-only apps")
        print("  python -m app.reset_demo --confirm --app-id <ID>  # Clears single app by ID")
        print("  python -m app.reset_demo --confirm --all --force  # Wipes all apps (DESTRUCTIVE)")
        sys.exit(1)

    if args.all and not args.force:
        print("Safety error: Resetting all applications requires both --all and --force flags.")
        sys.exit(1)

    demo_only = not args.all
    reset_demo_data(target_app_id=args.app_id, demo_only=demo_only)


if __name__ == "__main__":
    main()
