"""
TASKER Document Storage Migration CLI
Migrates existing local document files to Cloudinary and updates PostgreSQL metadata.

Usage (PowerShell):
    python migrate_local_to_cloudinary.py
    python migrate_local_to_cloudinary.py --cleanup
"""

import argparse
import json
import logging
import sys
from app.core.database import SessionLocal
from app.services.migration_service import migrate_local_documents_to_cloudinary

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("tasker_migration")


def main():
    parser = argparse.ArgumentParser(description="Migrate local TASKER documents to Cloudinary storage.")
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Safely remove local disk files ONLY after successful Cloudinary upload & DB verification.",
    )
    args = parser.parse_args()

    print("=" * 70)
    print(" TASKER — Industrial Approval & Compliance Platform")
    print(" Document Storage Migration to Cloudinary")
    print("=" * 70)

    db = SessionLocal()
    try:
        report = migrate_local_documents_to_cloudinary(db=db, cleanup_local_files=args.cleanup)
        print("\nMigration Results Summary:")
        print(f" • Total Documents Scanned : {report['total_documents_scanned']}")
        print(f" • Successfully Migrated   : {report['migrated_count']}")
        print(f" • Already in Cloudinary   : {report['already_migrated_count']}")
        print(f" • Failed Migrations       : {report['failed_count']}")
        print("=" * 70)
        print(json.dumps(report, indent=2))
        return 0 if report["failed_count"] == 0 else 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
