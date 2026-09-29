import logging
from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal, Base, engine
from app.models.approval_intelligence import (
    ApprovalCatalog,
    ApprovalRule,
    ApprovalDependency,
    ApprovalCoverage,
    WorkflowSLARule,
    ApprovalRecord,
    ComplianceTask,
    ExternalWorkflowStep,
    ApplicationEvent,
    DelayAnalysisRecord,
)
from app.models.business_profile import BusinessProfile
from app.models.application import ApprovalApplication, ApprovalJourney

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_approval_intelligence")


def seed_approval_catalog(db):
    catalogs = [
        {
            "code": "FSSAI",
            "name": "FSSAI Food Safety License / Registration",
            "department": "Food Safety and Standards Authority of India (FSSAI)",
            "category": "Food Safety & Public Health",
            "description": "Mandatory statutory license for manufacture, processing, packaging, storage, or distribution of food and beverage products under Food Safety and Standards Act 2006.",
            "source": "Food Safety and Standards (Licensing and Registration of Food Businesses) Regulations, 2011",
            "last_verified_date": "2026-09-01",
        },
        {
            "code": "GST",
            "name": "Goods and Services Tax (GST) Registration",
            "department": "Department of Revenue, Ministry of Finance (GST Network)",
            "category": "Taxation & Commercial Compliance",
            "description": "Statutory indirect tax registration under Central Goods and Services Tax Act 2017 for commercial supply of goods and inter-state trade.",
            "source": "Central Goods and Services Tax Act, 2017 (Section 22 & 24)",
            "last_verified_date": "2026-09-01",
        },
        {
            "code": "UDYAM",
            "name": "Udyam MSME Registration Certificate",
            "department": "Ministry of Micro, Small and Medium Enterprises (MSME)",
            "category": "Enterprise Classification & Incentives",
            "description": "Official government classification certificate enabling priority sector lending, collateral-free credit (CGTMSE), and state subsidies.",
            "source": "Ministry of MSME Gazette Notification S.O. 2119(E)",
            "last_verified_date": "2026-09-01",
        },
        {
            "code": "TRADEMARK",
            "name": "Trademark / Brand Registration",
            "department": "Controller General of Patents, Designs and Trade Marks (CGPDTM)",
            "category": "Intellectual Property Rights",
            "description": "Protection of brand name, brand logo, and intellectual product identity under Trade Marks Act 1999.",
            "source": "Trade Marks Act, 1999 & Trade Marks Rules, 2017",
            "last_verified_date": "2026-09-01",
        },
        {
            "code": "FIRE_NOC",
            "name": "Provisional / Final Fire Safety NOC",
            "department": "Directorate of Fire Services / Municipal Corporation",
            "category": "Life Safety & Disaster Prevention",
            "description": "Statutory fire prevention and safety clearance for manufacturing facilities, commercial warehouses, and hazardous storage units.",
            "source": "National Building Code of India (Part 4: Fire & Life Safety) / State Fire Act",
            "last_verified_date": "2026-09-01",
        },
        {
            "code": "MPCB_CTE",
            "name": "Consent to Establish (CTE) / Operate (CTO)",
            "department": "State Pollution Control Board (SPCB / TNPCB / MPCB)",
            "category": "Environmental Clearance",
            "description": "Statutory environmental permission for industrial emissions, trade effluent, and solid waste management under Water & Air Acts.",
            "source": "Water (Prevention and Control of Pollution) Act 1974 & Air Act 1981",
            "last_verified_date": "2026-09-01",
        },
    ]

    for item in catalogs:
        existing = db.query(ApprovalCatalog).filter(ApprovalCatalog.code == item["code"]).first()
        if not existing:
            cat = ApprovalCatalog(
                code=item["code"],
                name=item["name"],
                department=item["department"],
                category=item["category"],
                description=item["description"],
                source=item["source"],
                last_verified_date=item["last_verified_date"],
                active=True,
            )
            db.add(cat)
    db.commit()
    logger.info("Approval Catalog seeded.")


def seed_approval_rules(db):
    rules = [
        {
            "approval_id": "FSSAI",
            "industry": "Food Processing",
            "business_type": None,
            "business_activity": "Packaged Snack Manufacturing",
            "state": None,
            "district": None,
            "investment_min": 0.0,
            "investment_max": None,
            "employee_min": 0,
            "employee_max": None,
            "project_stage": None,
            "condition_json": {"food_involved": True, "category": "Food Processing"},
            "priority_base": "CRITICAL",
            "reason_template": "Your business profile indicates food processing and packaged snack manufacturing activity. TASKER therefore identifies the statutory Food Safety (FSSAI) workflow as a required foundational approval before commencing operations.",
            "online_coverage": "HYBRID",
            "external_requirement": "State food safety officer physical premises audit and hygiene inspection prior to final grant.",
            "source": "FSSAI Food Safety and Standards Regulations (Schedule 1 & 2)",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "GST",
            "industry": None,
            "business_type": None,
            "business_activity": None,
            "state": None,
            "district": None,
            "investment_min": 0.0,
            "investment_max": None,
            "employee_min": 0,
            "employee_max": None,
            "project_stage": None,
            "condition_json": {"commercial_operations": True},
            "priority_base": "HIGH",
            "reason_template": "Your enterprise engages in commercial production and distribution exceeding local statutory limits or undertaking inter-state supply. A GST registration is essential for tax compliance and invoicing.",
            "online_coverage": "ONLINE",
            "external_requirement": None,
            "source": "Central Goods and Services Tax Act 2017, Section 22/24",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "UDYAM",
            "industry": None,
            "business_type": None,
            "business_activity": None,
            "state": None,
            "district": None,
            "investment_min": 0.0,
            "investment_max": 5000.0,  # Up to ₹50 Crore for MSME
            "employee_min": 0,
            "employee_max": 250,
            "project_stage": None,
            "condition_json": {"is_msme_eligible": True},
            "priority_base": "HIGH",
            "reason_template": "Your investment (₹5.00 Cr) and workforce size qualify your enterprise as a registered MSME (Small Enterprise), unlocking statutory tariff incentives, priority credit guarantees, and subsidy schemes.",
            "online_coverage": "ONLINE",
            "external_requirement": None,
            "source": "Ministry of MSME Classification Criteria Notification S.O. 2119(E)",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "TRADEMARK",
            "industry": None,
            "business_type": None,
            "business_activity": None,
            "state": None,
            "district": None,
            "investment_min": 0.0,
            "investment_max": None,
            "employee_min": 0,
            "employee_max": None,
            "project_stage": None,
            "condition_json": {"brand_protection": True},
            "priority_base": "LOW",
            "reason_template": "Brand identity protection for unique proprietary packaged goods and logos. Can be registered alongside or after core operational clearances.",
            "online_coverage": "ONLINE",
            "external_requirement": None,
            "source": "Trade Marks Act 1999 (Class 29 & 30 for Processed Food)",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "FIRE_NOC",
            "industry": "Food Processing",
            "business_type": None,
            "business_activity": None,
            "state": None,
            "district": None,
            "investment_min": 200.0,  # ₹2 Cr+ industrial unit
            "investment_max": None,
            "employee_min": 50,
            "employee_max": None,
            "project_stage": "New Manufacturing Unit",
            "condition_json": {"factory_area_large": True},
            "priority_base": "MEDIUM",
            "reason_template": "For an industrial manufacturing facility with significant built-up area and workforce (>50 personnel), a Fire Safety NOC or municipal fire clearance is required.",
            "online_coverage": "EXTERNAL",
            "external_requirement": "On-site physical inspection by Chief Fire Officer and installation verification of fire suppression infrastructure.",
            "source": "State Fire Prevention and Life Safety Measures Act",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "MPCB_CTE",
            "industry": "Food Processing",
            "business_type": None,
            "business_activity": None,
            "state": None,
            "district": None,
            "investment_min": 100.0,
            "investment_max": None,
            "employee_min": 10,
            "employee_max": None,
            "project_stage": "New Manufacturing Unit",
            "condition_json": {"effluent_generation": True},
            "priority_base": "MEDIUM",
            "reason_template": "Food processing and agro-industrial operations generating trade effluent or washing discharge require Consent to Establish (Orange/Green Category) prior to civil commissioning.",
            "online_coverage": "EXTERNAL",
            "external_requirement": "Submission of Effluent Treatment Plant (ETP) blueprint and regional environmental engineer site inspection.",
            "source": "State Pollution Control Board Industrial Categorization Guideline",
            "last_verified_date": "2026-09-01",
        },
    ]

    for r in rules:
        existing = db.query(ApprovalRule).filter(
            ApprovalRule.approval_id == r["approval_id"],
            ApprovalRule.industry == r["industry"]
        ).first()
        if not existing:
            rule = ApprovalRule(
                approval_id=r["approval_id"],
                industry=r["industry"],
                business_type=r["business_type"],
                business_activity=r["business_activity"],
                state=r["state"],
                district=r["district"],
                investment_min=r["investment_min"],
                investment_max=r["investment_max"],
                employee_min=r["employee_min"],
                employee_max=r["employee_max"],
                project_stage=r["project_stage"],
                condition_json=r["condition_json"],
                priority_base=r["priority_base"],
                reason_template=r["reason_template"],
                online_coverage=r["online_coverage"],
                external_requirement=r["external_requirement"],
                source=r["source"],
                last_verified_date=r["last_verified_date"],
                active=True,
            )
            db.add(rule)
    db.commit()
    logger.info("Approval Rules seeded.")


def seed_approval_dependencies(db):
    deps = [
        {
            "approval_id": "GST",
            "depends_on_approval_id": "FSSAI",
            "dependency_type": "CAN_RUN_IN_PARALLEL",
            "description": "GST registration and FSSAI licensing can be prepared and submitted concurrently without blocking dependencies.",
        },
        {
            "approval_id": "UDYAM",
            "depends_on_approval_id": "GST",
            "dependency_type": "CAN_RUN_IN_PARALLEL",
            "description": "Udyam MSME registration can run in parallel with GST & FSSAI clearances.",
        },
        {
            "approval_id": "TRADEMARK",
            "depends_on_approval_id": "UDYAM",
            "dependency_type": "CAN_RUN_IN_PARALLEL",
            "description": "Trademark registration can be initiated at any stage; having Udyam registration entitles applicant to a 50% statutory fee concession.",
        },
        {
            "approval_id": "FIRE_NOC",
            "depends_on_approval_id": "FSSAI",
            "dependency_type": "RECOMMENDED_BEFORE",
            "description": "Recommended to prepare factory fire safety layout in conjunction with food manufacturing unit plan.",
        },
    ]

    for d in deps:
        existing = db.query(ApprovalDependency).filter(
            ApprovalDependency.approval_id == d["approval_id"],
            ApprovalDependency.depends_on_approval_id == d["depends_on_approval_id"]
        ).first()
        if not existing:
            dep = ApprovalDependency(
                approval_id=d["approval_id"],
                depends_on_approval_id=d["depends_on_approval_id"],
                dependency_type=d["dependency_type"],
                description=d["description"],
                active=True,
            )
            db.add(dep)
    db.commit()
    logger.info("Approval Dependencies seeded.")


def seed_approval_coverage(db):
    coverages = [
        {
            "approval_id": "FSSAI",
            "coverage_type": "HYBRID",
            "tasker_capabilities_json": [
                "Automated document classification & pre-validation",
                "Form-B application schema compilation",
                "Direct mock portal sync & fee receipt reconciliation",
                "Real-time officer scrutiny tracking & query management",
                "Digital license vault & expiry alerts",
            ],
            "external_steps_json": [
                "Physical inspection of food manufacturing premises by Designated Officer",
                "Water test potability lab report submission",
                "FSMS food safety supervisor certification review",
            ],
            "region": "South Zone / Tamil Nadu",
            "state": "Tamil Nadu",
            "district": "Salem",
            "authority": "Designated Officer, Food Safety & Standards Authority of India",
            "authority_location": "Salem Collectorate Administrative Complex, Salem, Tamil Nadu - 636001",
            "latitude": 11.6643,
            "longitude": 78.1460,
            "source": "State Single Window Clearance Portal (Guidance Bureau TN)",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "GST",
            "coverage_type": "ONLINE",
            "tasker_capabilities_json": [
                "End-to-end unified application preparation (Form GST REG-01)",
                "Document vault auto-linking (Electricity Bill, Rent Deed, PAN)",
                "Instant ARN tracking and officer query communication",
                "Automated GSTIN certificate download into Document Center",
            ],
            "external_steps_json": [],
            "region": "Salem Commissionerate",
            "state": "Tamil Nadu",
            "district": "Salem",
            "authority": "Office of the Assistant Commissioner of Central Tax & State GST",
            "authority_location": "GST Bhavan, No. 1 Foulke's Compound, Salem, Tamil Nadu - 636007",
            "latitude": 11.6583,
            "longitude": 78.1578,
            "source": "GST System Regulations & Advisory 2026",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "UDYAM",
            "coverage_type": "ONLINE",
            "tasker_capabilities_json": [
                "Aadhaar & PAN auto-verification bridge",
                "MSME enterprise classification & investment formula calculator",
                "Instant simulated Udyam Registration Number (URN) generation",
                "Permanent compliance certificate archival",
            ],
            "external_steps_json": [],
            "region": "District Industries Centre (DIC)",
            "state": "Tamil Nadu",
            "district": "Salem",
            "authority": "General Manager, District Industries Centre (DIC), Salem",
            "authority_location": "Five Roads, Omalur Main Road, Jagir Ammapalayam, Salem - 636302",
            "latitude": 11.6825,
            "longitude": 78.1340,
            "source": "Ministry of MSME Portal Guidelines",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "TRADEMARK",
            "coverage_type": "ONLINE",
            "tasker_capabilities_json": [
                "TM-A application drafting & NICE classification search",
                "Power of Attorney & logo specimen attachment",
                "Journal publication & examination report tracking",
            ],
            "external_steps_json": [],
            "region": "Chennai Patent & Trademark Office",
            "state": "Tamil Nadu",
            "district": "Chennai",
            "authority": "Trade Marks Registry, Intellectual Property Building",
            "authority_location": "G.S.T. Road, Guindy, Chennai, Tamil Nadu - 600032",
            "latitude": 13.0102,
            "longitude": 80.2158,
            "source": "CGPDTM Trademark Rules 2017",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "FIRE_NOC",
            "coverage_type": "EXTERNAL",
            "tasker_capabilities_json": [
                "Checklist of required fire safety equipment",
                "External application tracking & milestone logging",
                "NOC certificate upload and renewal scheduler",
            ],
            "external_steps_json": [
                "Submission of architectural fire layout to District Fire Officer",
                "On-site hydraulic hydrant testing & smoke detector inspection",
                "Collection of physical provisional Fire Safety NOC",
            ],
            "region": "Salem District Fire Station",
            "state": "Tamil Nadu",
            "district": "Salem",
            "authority": "District Fire Officer, Tamil Nadu Fire & Rescue Services",
            "authority_location": "Suramangalam Main Road, Salem, Tamil Nadu - 636005",
            "latitude": 11.6710,
            "longitude": 78.1290,
            "source": "Tamil Nadu Fire & Rescue Services Guidelines",
            "last_verified_date": "2026-09-01",
        },
        {
            "approval_id": "MPCB_CTE",
            "coverage_type": "EXTERNAL",
            "tasker_capabilities_json": [
                "Effluent generation category guidance",
                "Document preparation for Consent to Establish",
                "External step milestone tracking & inspection recording",
            ],
            "external_steps_json": [
                "Detailed Project Report (DPR) physical filing with District Environmental Engineer",
                "Trade effluent treatment plant (ETP) blueprint inspection",
                "Air sampling & baseline environmental ambient report",
            ],
            "region": "District Environmental Office",
            "state": "Tamil Nadu",
            "district": "Salem",
            "authority": "District Environmental Engineer, Tamil Nadu Pollution Control Board (TNPCB)",
            "authority_location": "Siva Tower, Cherry Road, Salem, Tamil Nadu - 636007",
            "latitude": 11.6620,
            "longitude": 78.1630,
            "source": "TNPCB Industrial Classification & Consent Rules",
            "last_verified_date": "2026-09-01",
        },
    ]

    for c in coverages:
        existing = db.query(ApprovalCoverage).filter(
            ApprovalCoverage.approval_id == c["approval_id"],
            ApprovalCoverage.district == c["district"]
        ).first()
        if not existing:
            cov = ApprovalCoverage(
                approval_id=c["approval_id"],
                coverage_type=c["coverage_type"],
                tasker_capabilities_json=c["tasker_capabilities_json"],
                external_steps_json=c["external_steps_json"],
                region=c["region"],
                state=c["state"],
                district=c["district"],
                authority=c["authority"],
                authority_location=c["authority_location"],
                latitude=c["latitude"],
                longitude=c["longitude"],
                source=c["source"],
                last_verified_date=c["last_verified_date"],
                active=True,
            )
            db.add(cov)
    db.commit()
    logger.info("Approval Coverage seeded.")


def seed_sla_rules(db):
    sla_data = [
        {"approval_id": "FSSAI", "status": "SUBMITTED", "expected_duration_days": 2.0, "warning_after_days": 4.0, "critical_after_days": 7.0},
        {"approval_id": "FSSAI", "status": "UNDER_REVIEW", "expected_duration_days": 5.0, "warning_after_days": 8.0, "critical_after_days": 12.0},
        {"approval_id": "FSSAI", "status": "DOCUMENT_QUERY", "expected_duration_days": 3.0, "warning_after_days": 5.0, "critical_after_days": 7.0},
        {"approval_id": "FSSAI", "status": "INSPECTION_SCHEDULED", "expected_duration_days": 7.0, "warning_after_days": 10.0, "critical_after_days": 15.0},
        {"approval_id": "GST", "status": "SUBMITTED", "expected_duration_days": 1.0, "warning_after_days": 3.0, "critical_after_days": 5.0},
        {"approval_id": "GST", "status": "UNDER_REVIEW", "expected_duration_days": 3.0, "warning_after_days": 5.0, "critical_after_days": 7.0},
        {"approval_id": "GST", "status": "DOCUMENT_QUERY", "expected_duration_days": 2.0, "warning_after_days": 4.0, "critical_after_days": 7.0},
        {"approval_id": "UDYAM", "status": "SUBMITTED", "expected_duration_days": 0.5, "warning_after_days": 1.0, "critical_after_days": 2.0},
        {"approval_id": "TRADEMARK", "status": "UNDER_REVIEW", "expected_duration_days": 15.0, "warning_after_days": 25.0, "critical_after_days": 45.0},
    ]

    for item in sla_data:
        existing = db.query(WorkflowSLARule).filter(
            WorkflowSLARule.approval_id == item["approval_id"],
            WorkflowSLARule.status == item["status"]
        ).first()
        if not existing:
            rule = WorkflowSLARule(
                approval_id=item["approval_id"],
                status=item["status"],
                expected_duration_days=item["expected_duration_days"],
                warning_after_days=item["warning_after_days"],
                critical_after_days=item["critical_after_days"],
                source="Ease of Doing Business Standard Operating Timelines 2026",
                last_verified_date="2026-09-01",
                active=True,
            )
            db.add(rule)
    db.commit()
    logger.info("Workflow SLA Rules seeded.")


def seed_demo_profile_and_compliance(db):
    """Configures ABC Foods Pvt Ltd / Rahul Kumar with active compliance records and realistic demo states."""
    from app.models.user import User
    demo_user = db.query(User).filter(User.email == "applicant@demo.com").first()
    
    profile = None
    if demo_user:
        profile = db.query(BusinessProfile).filter(BusinessProfile.user_id == demo_user.id).first()
        if not profile:
            profile = BusinessProfile(
                user_id=demo_user.id,
                company_name="ABC Foods Private Limited",
                business_type="Private Limited Company",
                organization_type="Private Limited",
                industry="Food Processing",
                business_activity="Packaged Snack Manufacturing",
                state="Tamil Nadu",
                district="Salem",
                pincode="636001",
                address="Plot No. 42, SIPCOT Industrial Park, Salem, Tamil Nadu",
                investment_amount=500.0,
                expected_turnover=2000.0,
                employee_count=100,
                project_stage="New Manufacturing Unit",
                land_status="Allotted Industrial Plot",
                premises_type="Industrial Estate",
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        else:
            profile.company_name = "ABC Foods Private Limited"
            profile.industry = "Food Processing"
            profile.business_activity = "Packaged Snack Manufacturing"
            profile.district = "Salem"
            profile.state = "Tamil Nadu"
            profile.investment_amount = 500.0
            profile.employee_count = 100
            db.commit()

    if not profile:
        profile = db.query(BusinessProfile).first()

    if profile:
        # Check/create approval records for ABC Foods
        fssai_record = db.query(ApprovalRecord).filter(
            ApprovalRecord.business_profile_id == profile.id,
            ApprovalRecord.approval_id == "FSSAI"
        ).first()

        now = datetime.now(timezone.utc)
        if not fssai_record:
            fssai_record = ApprovalRecord(
                business_profile_id=profile.id,
                approval_id="FSSAI",
                registration_number="12426002000088",
                status="ACTIVE",
                issue_date=now - timedelta(days=322),
                effective_date=now - timedelta(days=322),
                expiry_date=now + timedelta(days=43),  # 43 days remaining! Perfect for renewal approaching demo
                renewal_required=True,
                renewal_window_days=90,
                last_verified_at=now,
            )
            db.add(fssai_record)

        udyam_record = db.query(ApprovalRecord).filter(
            ApprovalRecord.business_profile_id == profile.id,
            ApprovalRecord.approval_id == "UDYAM"
        ).first()

        if not udyam_record:
            udyam_record = ApprovalRecord(
                business_profile_id=profile.id,
                approval_id="UDYAM",
                registration_number="UDYAM-TN-24-0098712",
                status="ACTIVE",
                issue_date=now - timedelta(days=120),
                effective_date=now - timedelta(days=120),
                expiry_date=None,  # Lifetime
                renewal_required=False,
                renewal_window_days=0,
                last_verified_at=now,
            )
            db.add(udyam_record)

        db.commit()

        # Seed compliance tasks
        task1 = db.query(ComplianceTask).filter(
            ComplianceTask.business_profile_id == profile.id,
            ComplianceTask.title.ilike("%FSSAI License Renewal%")
        ).first()

        if not task1 and fssai_record:
            task1 = ComplianceTask(
                business_profile_id=profile.id,
                approval_record_id=fssai_record.id,
                task_type="RENEWAL",
                title="Plan FSSAI License Renewal (Form C)",
                description="Your FSSAI Manufacturing License expires on 30 Nov 2026 (43 days remaining). Statutory window requires filing renewal at least 30 days before expiry.",
                due_date=now + timedelta(days=13),
                status="PENDING",
                priority="HIGH",
                source="TASKER Renewal Intelligence Engine",
            )
            db.add(task1)

        task2 = db.query(ComplianceTask).filter(
            ComplianceTask.business_profile_id == profile.id,
            ComplianceTask.title.ilike("%Water Potability%")
        ).first()

        if not task2:
            task2 = ComplianceTask(
                business_profile_id=profile.id,
                approval_record_id=fssai_record.id if fssai_record else None,
                task_type="WATER_TEST",
                title="Submit NABL Water Potability Annual Test Report",
                description="Statutory condition under Schedule 4: Annual microbiological and chemical water test report from an accredited laboratory.",
                due_date=now + timedelta(days=25),
                status="PENDING",
                priority="MEDIUM",
                source="Food Safety Statutory Annual Compliance Grid",
            )
            db.add(task2)

        # Seed external workflow step
        ext_step = db.query(ExternalWorkflowStep).filter(
            ExternalWorkflowStep.approval_id == "FIRE_NOC",
            ExternalWorkflowStep.step_name.ilike("%Fire Safety%")
        ).first()

        if not ext_step:
            ext_step = ExternalWorkflowStep(
                approval_id="FIRE_NOC",
                step_name="Fire Safety Infrastructure On-Site Scrutiny",
                description="Coordinating physical visit with Salem District Fire Officer for industrial fire hydrant and extinguisher inspection.",
                step_type="INSPECTION",
                status="WAITING",
                required=True,
                source="District Fire Officer Salem Schedule",
            )
            db.add(ext_step)

        db.commit()
        logger.info("Demo Profile Compliance & Tasks seeded.")


def seed_approval_intelligence_all():
    db = SessionLocal()
    try:
        # Fast exit if already seeded
        if db.query(ApprovalCatalog).count() >= 4 and db.query(ApprovalRule).count() >= 4:
            return

        seed_approval_catalog(db)
        seed_approval_rules(db)
        seed_approval_dependencies(db)
        seed_approval_coverage(db)
        seed_sla_rules(db)
        seed_demo_profile_and_compliance(db)
        logger.info("All Approval Intelligence seeds applied successfully.")
    except Exception as e:
        logger.error(f"Error seeding approval intelligence: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed_approval_intelligence_all()
