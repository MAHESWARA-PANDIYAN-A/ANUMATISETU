import logging
from app.core.database import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.application import Department

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")


def seed_departments():
    """Seeds default configurable departments for industrial clearance workflows."""
    db = SessionLocal()
    try:
        if db.query(Department).count() >= 4:
            return

        default_departments = [
            {
                "code": "IND",
                "name": "Directorate of Industries",
                "description": "State industrial registration, MSME incentives, industrial land zoning, and package scheme of incentives.",
                "contact_email": "industries.dept@maharashtra.gov.in",
                "sla_days": 15,
                "is_active": True,
            },
            {
                "code": "MPCB",
                "name": "Maharashtra Pollution Control Board (MPCB)",
                "description": "Consent to Establish (CTE) & Operate (CTO) under Water (Prevention & Control of Pollution) Act and Air Act.",
                "contact_email": "ro.pune@mpcb.gov.in",
                "sla_days": 30,
                "is_active": True,
            },
            {
                "code": "FIRE",
                "name": "Directorate of Maharashtra Fire Services",
                "description": "Provisional & Final Fire Safety NOC, fire fighting infrastructure scrutiny and compliance certification.",
                "contact_email": "cfo.mfs@maharashtra.gov.in",
                "sla_days": 14,
                "is_active": True,
            },
            {
                "code": "LOCAL",
                "name": "Urban Local Body / MIDC Planning Authority",
                "description": "Building blueprint approvals, municipal trade license, factory land development permission.",
                "contact_email": "planning@midcindia.org",
                "sla_days": 21,
                "is_active": True,
            },
        ]

        created_count = 0
        for d in default_departments:
            existing = db.query(Department).filter(Department.code == d["code"]).first()
            if not existing:
                new_dept = Department(
                    code=d["code"],
                    name=d["name"],
                    description=d["description"],
                    contact_email=d["contact_email"],
                    sla_days=d["sla_days"],
                    is_active=d["is_active"],
                )
                db.add(new_dept)
                created_count += 1
                logger.info(f"Seeded department: {d['code']} - {d['name']}")

        db.commit()
        if created_count > 0:
            logger.info(f"Seeded {created_count} default departments.")
    except Exception as e:
        logger.error(f"Error seeding departments: {e}")
        db.rollback()
    finally:
        db.close()


def seed_demo_users():
    """Seeds default demo accounts for APPLICANT, OFFICER, and ADMIN roles."""
    db = SessionLocal()
    try:
        demo_users = [
            {
                "email": "applicant@demo.com",
                "full_name": "Ramesh Patel (Sunrise Agro)",
                "password": "Password123!",
                "role": UserRole.APPLICANT,
                "phone": "+91 98200 12345",
                "department": None
            },
            {
                "email": "officer.mpcb@gov.in",
                "full_name": "Dr. Ananya Deshmukh",
                "password": "Password123!",
                "role": UserRole.OFFICER,
                "phone": "+91 98200 54321",
                "department": "Maharashtra Pollution Control Board (MPCB)"
            },
            {
                "email": "cfo.fire@gov.in",
                "full_name": "Chief Officer V. K. Kadam",
                "password": "Password123!",
                "role": UserRole.OFFICER,
                "phone": "+91 98200 67890",
                "department": "Directorate of Maharashtra Fire Services"
            },
            {
                "email": "admin@sih26130.gov.in",
                "full_name": "System Administrator",
                "password": "Password123!",
                "role": UserRole.ADMIN,
                "phone": "+91 98200 99999",
                "department": "Department of Industries"
            }
        ]

        created_count = 0
        for u in demo_users:
            existing = db.query(User).filter(User.email == u["email"]).first()
            if not existing:
                new_user = User(
                    email=u["email"],
                    hashed_password=hash_password(u["password"]),
                    full_name=u["full_name"],
                    role=u["role"],
                    phone=u["phone"],
                    department=u["department"],
                    is_active=True
                )
                db.add(new_user)
                created_count += 1
                logger.info(f"Seeded user: {u['email']} [{u['role'].value}]")

        db.commit()
        if created_count > 0:
            logger.info(f"Seeding completed. {created_count} users added.")
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


def seed_all():
    Base.metadata.create_all(bind=engine)
    seed_departments()
    seed_demo_users()


if __name__ == "__main__":
    seed_all()
