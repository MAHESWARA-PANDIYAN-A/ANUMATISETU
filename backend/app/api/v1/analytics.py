from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, get_optional_current_user
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsDashboardResponse,
    AnalyticsMetricsSchema,
    AnalyticsChartsSchema,
    BottleneckReportItem,
)
from app.services.analytics_service import calculate_analytics_metrics

router = APIRouter(prefix="/analytics", tags=["Government Analytics & Executive Intelligence"])


@router.get("/dashboard", response_model=AnalyticsDashboardResponse)
def get_analytics_dashboard(
    start_date: Optional[str] = Query(None, description="Start date in ISO format (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date in ISO format (YYYY-MM-DD)"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    status: Optional[str] = Query(None, description="Filter by Application status"),
    industry: Optional[str] = Query(None, description="Filter by Industry"),
    state: Optional[str] = Query(None, description="Filter by State"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    """
    Unified Government Executive Analytics endpoint.
    Aggregates live database metrics, status charts, department workloads, SLA tracking,
    and potential processing bottleneck observations.
    """
    parsed_start = None
    parsed_end = None
    if start_date:
        try:
            parsed_start = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use ISO format (YYYY-MM-DD).")
    if end_date:
        try:
            parsed_end = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use ISO format (YYYY-MM-DD).")

    res = calculate_analytics_metrics(
        db=db,
        start_date=parsed_start,
        end_date=parsed_end,
        department_id=department_id,
        status=status,
        industry=industry,
        state=state,
    )
    res["generated_at"] = datetime.now().isoformat()
    return res


@router.get("/metrics", response_model=AnalyticsMetricsSchema)
def get_executive_metrics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get high-level KPI metrics computed dynamically from active database records."""
    parsed_start = datetime.fromisoformat(start_date) if start_date else None
    parsed_end = datetime.fromisoformat(end_date) if end_date else None
    data = calculate_analytics_metrics(
        db=db,
        start_date=parsed_start,
        end_date=parsed_end,
        department_id=department_id,
        status=status,
        industry=industry,
        state=state,
    )
    return data["metrics"]


@router.get("/bottlenecks", response_model=List[BottleneckReportItem])
def get_bottleneck_observations(
    db: Session = Depends(get_db),
):
    """
    Identifies potential department bottlenecks based on observed processing durations
    and SLA breach rates.
    """
    data = calculate_analytics_metrics(db=db)
    return data["bottlenecks"]


@router.get("/charts", response_model=AnalyticsChartsSchema)
def get_analytics_charts(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get charted series data for status, department workload, SLA, processing time, and monthly trends."""
    parsed_start = datetime.fromisoformat(start_date) if start_date else None
    parsed_end = datetime.fromisoformat(end_date) if end_date else None
    data = calculate_analytics_metrics(
        db=db,
        start_date=parsed_start,
        end_date=parsed_end,
        department_id=department_id,
        status=status,
        industry=industry,
        state=state,
    )
    return data["charts"]
