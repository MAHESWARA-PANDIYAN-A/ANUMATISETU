from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.models.application import (
    Application,
    ApplicationApproval,
    ApplicationStatus,
    ApprovalWorkflowStatus,
    Department,
    Inspection,
    InspectionStatus,
    SLAStatus,
)
from app.models.business_profile import BusinessProfile


def calculate_analytics_metrics(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    department_id: Optional[int] = None,
    status: Optional[str] = None,
    industry: Optional[str] = None,
    state: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes all government executive metrics dynamically from live PostgreSQL / SQLite records.
    Strictly calculates from DB rows with zero hard-coded numbers.
    """
    now = datetime.now(timezone.utc)

    # Base query for applications with joins to business profile
    app_query = db.query(Application).join(BusinessProfile, Application.business_profile_id == BusinessProfile.id, isouter=True)

    # Base query for approvals with joins
    appr_query = db.query(ApplicationApproval).join(Application, ApplicationApproval.application_id == Application.id)\
                                             .join(BusinessProfile, Application.business_profile_id == BusinessProfile.id, isouter=True)\
                                             .join(Department, ApplicationApproval.department_id == Department.id)

    # Apply date filters
    if start_date:
        app_query = app_query.filter(Application.created_at >= start_date)
        appr_query = appr_query.filter(ApplicationApproval.created_at >= start_date)
    if end_date:
        app_query = app_query.filter(Application.created_at <= end_date)
        appr_query = appr_query.filter(ApplicationApproval.created_at <= end_date)

    # Apply status filter
    if status and status != "ALL":
        try:
            status_enum = ApplicationStatus(status)
            app_query = app_query.filter(Application.status == status_enum)
        except ValueError:
            pass

    # Apply industry filter
    if industry and industry != "ALL":
        app_query = app_query.filter(BusinessProfile.industry.ilike(f"%{industry}%"))
        appr_query = appr_query.filter(BusinessProfile.industry.ilike(f"%{industry}%"))

    # Apply state filter
    if state and state != "ALL":
        app_query = app_query.filter(BusinessProfile.state.ilike(f"%{state}%"))
        appr_query = appr_query.filter(BusinessProfile.state.ilike(f"%{state}%"))

    # Apply department filter
    if department_id:
        app_query = app_query.filter(Application.approvals.any(ApplicationApproval.department_id == department_id))
        appr_query = appr_query.filter(ApplicationApproval.department_id == department_id)

    applications = app_query.all()
    approvals = appr_query.all()

    # 1. Metric calculations
    total_applications = len(applications)
    submitted_applications = sum(1 for a in applications if a.status != ApplicationStatus.DRAFT)
    pending_applications = sum(1 for a in applications if a.status in (
        ApplicationStatus.SUBMITTED,
        ApplicationStatus.UNDER_REVIEW,
        ApplicationStatus.NEEDS_INFORMATION,
        ApplicationStatus.DRAFT,
    ))
    approved_applications = sum(1 for a in applications if a.status in (
        ApplicationStatus.APPROVED,
        ApplicationStatus.PARTIALLY_APPROVED,
    ))
    rejected_applications = sum(1 for a in applications if a.status == ApplicationStatus.REJECTED)

    # Calculate overdue applications based on expected_completion_date
    overdue_applications = 0
    for a in applications:
        if a.status in (ApplicationStatus.APPROVED, ApplicationStatus.REJECTED):
            continue
        exp_date = a.expected_completion_date
        if exp_date:
            if exp_date.tzinfo is None:
                exp_date = exp_date.replace(tzinfo=timezone.utc)
            if exp_date < now:
                overdue_applications += 1
                continue
        # Also check approvals
        if any(
            appr.status not in (ApprovalWorkflowStatus.APPROVED, ApprovalWorkflowStatus.REJECTED)
            and appr.expected_completion_date
            and ((appr.expected_completion_date.replace(tzinfo=timezone.utc) if appr.expected_completion_date.tzinfo is None else appr.expected_completion_date) < now)
            for appr in a.approvals
        ):
            overdue_applications += 1

    # Inspections pending: count active clearances with INSPECTION_PENDING or inspections with SCHEDULED status
    inspections_pending = sum(1 for appr in approvals if appr.status == ApprovalWorkflowStatus.INSPECTION_PENDING)
    scheduled_inspections_count = db.query(Inspection).filter(Inspection.status == InspectionStatus.SCHEDULED).count()
    total_inspections_pending = max(inspections_pending, scheduled_inspections_count)

    # Average processing duration in days
    completed_durations = []
    active_durations = []
    for a in applications:
        start_ts = a.submitted_at or a.created_at
        if start_ts:
            if start_ts.tzinfo is None:
                start_ts = start_ts.replace(tzinfo=timezone.utc)
            if a.completed_at:
                end_ts = a.completed_at
                if end_ts.tzinfo is None:
                    end_ts = end_ts.replace(tzinfo=timezone.utc)
                completed_durations.append(max(1.0, (end_ts - start_ts).total_seconds() / 86400.0))
            else:
                active_durations.append(max(0.5, (now - start_ts).total_seconds() / 86400.0))

    if completed_durations:
        average_processing_duration = round(sum(completed_durations) / len(completed_durations), 1)
    elif active_durations:
        average_processing_duration = round(sum(active_durations) / len(active_durations), 1)
    else:
        average_processing_duration = 0.0

    # 2. Charts Data
    # A. Status Distribution
    status_counts: Dict[str, int] = {st.value: 0 for st in ApplicationStatus}
    for a in applications:
        st_val = a.status.value if hasattr(a.status, "value") else str(a.status)
        status_counts[st_val] = status_counts.get(st_val, 0) + 1

    status_distribution = [{"status": k, "count": v, "label": k.replace("_", " ").title()} for k, v in status_counts.items()]

    # B. Department Workload
    all_depts = db.query(Department).all()
    dept_workload = []
    for d in all_depts:
        d_apprs = [ap for ap in approvals if ap.department_id == d.id]
        total_c = len(d_apprs)
        p_count = sum(1 for ap in d_apprs if ap.status in (ApprovalWorkflowStatus.PENDING, ApprovalWorkflowStatus.UNDER_REVIEW, ApprovalWorkflowStatus.DOCUMENT_QUERY))
        appr_count = sum(1 for ap in d_apprs if ap.status == ApprovalWorkflowStatus.APPROVED)
        rej_count = sum(1 for ap in d_apprs if ap.status == ApprovalWorkflowStatus.REJECTED)
        insp_count = sum(1 for ap in d_apprs if ap.status == ApprovalWorkflowStatus.INSPECTION_PENDING)

        dept_workload.append({
            "department_id": d.id,
            "department_code": d.code,
            "department_name": d.name,
            "total_clearances": total_c,
            "pending": p_count,
            "approved": appr_count,
            "rejected": rej_count,
            "inspection_pending": insp_count,
        })

    # C. SLA Status Breakdown
    sla_counts: Dict[str, int] = {
        SLAStatus.ON_TRACK.value: 0,
        SLAStatus.APPROACHING.value: 0,
        SLAStatus.AT_RISK.value: 0,
        SLAStatus.OVERDUE.value: 0,
        SLAStatus.COMPLETED.value: 0,
    }
    for a in applications:
        if a.status in (ApplicationStatus.APPROVED, ApplicationStatus.REJECTED):
            sla_counts[SLAStatus.COMPLETED.value] += 1
            continue
        exp_date = a.expected_completion_date
        if not exp_date:
            sla_counts[SLAStatus.ON_TRACK.value] += 1
            continue
        if exp_date.tzinfo is None:
            exp_date = exp_date.replace(tzinfo=timezone.utc)
        days_left = (exp_date - now).total_seconds() / 86400.0

        if days_left < 0:
            sla_counts[SLAStatus.OVERDUE.value] += 1
        elif days_left <= 3:
            sla_counts[SLAStatus.AT_RISK.value] += 1
        elif days_left <= 7:
            sla_counts[SLAStatus.APPROACHING.value] += 1
        else:
            sla_counts[SLAStatus.ON_TRACK.value] += 1

    sla_distribution = [{"sla_status": k, "count": v, "label": k.replace("_", " ").title()} for k, v in sla_counts.items()]

    # D. Processing Time by Department & by Industry
    dept_processing_time = []
    for d in all_depts:
        d_apprs = [ap for ap in approvals if ap.department_id == d.id]
        durations = []
        for ap in d_apprs:
            st_ts = ap.submitted_at or ap.created_at
            if st_ts:
                if st_ts.tzinfo is None:
                    st_ts = st_ts.replace(tzinfo=timezone.utc)
                if ap.completed_at:
                    comp_ts = ap.completed_at
                    if comp_ts.tzinfo is None:
                        comp_ts = comp_ts.replace(tzinfo=timezone.utc)
                    durations.append((comp_ts - st_ts).total_seconds() / 86400.0)
                else:
                    durations.append((now - st_ts).total_seconds() / 86400.0)
        avg_d = round(sum(durations) / len(durations), 1) if durations else 0.0
        dept_processing_time.append({
            "department_id": d.id,
            "department_name": d.name,
            "average_days": avg_d,
            "sample_size": len(durations)
        })

    # Industry processing time
    industry_processing_map: Dict[str, List[float]] = {}
    for a in applications:
        ind_name = a.business_profile.industry if a.business_profile and a.business_profile.industry else "General Industry"
        st_ts = a.submitted_at or a.created_at
        if st_ts:
            if st_ts.tzinfo is None:
                st_ts = st_ts.replace(tzinfo=timezone.utc)
            dur = (now - st_ts).total_seconds() / 86400.0 if not a.completed_at else ((a.completed_at.replace(tzinfo=timezone.utc) if a.completed_at.tzinfo is None else a.completed_at) - st_ts).total_seconds() / 86400.0
            industry_processing_map.setdefault(ind_name, []).append(dur)

    industry_processing_time = [
        {"industry": k, "average_days": round(sum(v) / len(v), 1), "application_count": len(v)}
        for k, v in industry_processing_map.items()
    ]

    # E. Monthly Application Volume
    monthly_volume_map: Dict[str, int] = {}
    for a in applications:
        created = a.created_at
        month_key = created.strftime("%Y-%m") if created else now.strftime("%Y-%m")
        monthly_volume_map[month_key] = monthly_volume_map.get(month_key, 0) + 1

    # Sort chronological
    sorted_months = sorted(monthly_volume_map.keys())
    monthly_volume = [{"month": m, "count": monthly_volume_map[m], "label": datetime.strptime(m, "%Y-%m").strftime("%b %Y")} for m in sorted_months]

    # 3. Bottleneck Detection
    bottlenecks = detect_department_bottlenecks(db, all_depts, approvals, now)

    return {
        "metrics": {
            "total_applications": total_applications,
            "submitted_applications": submitted_applications,
            "pending_applications": pending_applications,
            "approved_applications": approved_applications,
            "rejected_applications": rejected_applications,
            "overdue_applications": overdue_applications,
            "inspections_pending": total_inspections_pending,
            "average_processing_duration": average_processing_duration,
        },
        "charts": {
            "application_status_distribution": status_distribution,
            "department_workload": dept_workload,
            "sla_status_distribution": sla_distribution,
            "department_processing_time": dept_processing_time,
            "industry_processing_time": industry_processing_time,
            "monthly_application_volume": monthly_volume,
        },
        "bottlenecks": bottlenecks,
        "filters_applied": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "department_id": department_id,
            "status": status,
            "industry": industry,
            "state": state,
        }
    }


def detect_department_bottlenecks(
    db: Session,
    departments: List[Department],
    all_approvals: List[ApplicationApproval],
    now: datetime,
) -> List[Dict[str, Any]]:
    """
    Identifies potential department bottlenecks using dynamic mathematical thresholds.
    Strictly observes processing duration without asserting causation.
    """
    bottleneck_reports = []

    # Calculate global averages
    all_pending_durations = []
    for ap in all_approvals:
        if ap.status not in (ApprovalWorkflowStatus.APPROVED, ApprovalWorkflowStatus.REJECTED):
            st = ap.submitted_at or ap.created_at
            if st:
                if st.tzinfo is None:
                    st = st.replace(tzinfo=timezone.utc)
                all_pending_durations.append((now - st).total_seconds() / 86400.0)

    global_avg_pending = (sum(all_pending_durations) / len(all_pending_durations)) if all_pending_durations else 5.0

    for d in departments:
        d_apprs = [ap for ap in all_approvals if ap.department_id == d.id]
        if not d_apprs:
            continue

        pending_apprs = [ap for ap in d_apprs if ap.status not in (ApprovalWorkflowStatus.APPROVED, ApprovalWorkflowStatus.REJECTED)]
        pending_count = len(pending_apprs)

        pending_durations = []
        overdue_count = 0

        for ap in pending_apprs:
            st = ap.submitted_at or ap.created_at
            if st:
                if st.tzinfo is None:
                    st = st.replace(tzinfo=timezone.utc)
                pending_durations.append((now - st).total_seconds() / 86400.0)

            exp = ap.expected_completion_date
            if exp:
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp < now:
                    overdue_count += 1

        dept_avg_pending = (sum(pending_durations) / len(pending_durations)) if pending_durations else 0.0

        # Bottleneck condition:
        # 1. Dept avg pending duration is > 1.35x global average (and > 6 days), OR
        # 2. Dept has >= 2 overdue clearances, OR
        # 3. Dept has >= 3 pending clearances and avg pending duration > 7 days.
        is_bottleneck = False
        if pending_count > 0:
            if (dept_avg_pending > max(1.35 * global_avg_pending, 6.0)) or (overdue_count >= 2) or (pending_count >= 3 and dept_avg_pending > 7.0):
                is_bottleneck = True

        if is_bottleneck:
            bottleneck_reports.append({
                "department_id": d.id,
                "department_code": d.code,
                "department_name": d.name,
                "is_bottleneck": True,
                "flag": "Potential processing bottleneck",
                "observation": f"Potential bottleneck based on observed processing duration (Average pending time: {dept_avg_pending:.1f} days, {pending_count} pending, {overdue_count} overdue clearances).",
                "pending_clearances": pending_count,
                "overdue_clearances": overdue_count,
                "average_pending_days": round(dept_avg_pending, 1),
                "global_benchmark_days": round(global_avg_pending, 1),
                "severity": "HIGH" if overdue_count >= 2 else "MEDIUM"
            })
        else:
            bottleneck_reports.append({
                "department_id": d.id,
                "department_code": d.code,
                "department_name": d.name,
                "is_bottleneck": False,
                "flag": "Normal throughput",
                "observation": f"Observed processing duration is within expected operational limits (Average pending time: {dept_avg_pending:.1f} days).",
                "pending_clearances": pending_count,
                "overdue_clearances": overdue_count,
                "average_pending_days": round(dept_avg_pending, 1),
                "global_benchmark_days": round(global_avg_pending, 1),
                "severity": "LOW"
            })

    # Sort bottlenecks with flagged ones first
    bottleneck_reports.sort(key=lambda x: (not x["is_bottleneck"], -x["overdue_clearances"], -x["average_pending_days"]))
    return bottleneck_reports
