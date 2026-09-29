from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class AnalyticsMetricsSchema(BaseModel):
    total_applications: int
    submitted_applications: int
    pending_applications: int
    approved_applications: int
    rejected_applications: int
    overdue_applications: int
    inspections_pending: int
    average_processing_duration: float


class StatusDistributionItem(BaseModel):
    status: str
    count: int
    label: str


class DepartmentWorkloadItem(BaseModel):
    department_id: int
    department_code: str
    department_name: str
    total_clearances: int
    pending: int
    approved: int
    rejected: int
    inspection_pending: int


class SLADistributionItem(BaseModel):
    sla_status: str
    count: int
    label: str


class DepartmentProcessingTimeItem(BaseModel):
    department_id: int
    department_name: str
    average_days: float
    sample_size: int


class IndustryProcessingTimeItem(BaseModel):
    industry: str
    average_days: float
    application_count: int


class MonthlyVolumeItem(BaseModel):
    month: str
    count: int
    label: str


class AnalyticsChartsSchema(BaseModel):
    application_status_distribution: List[StatusDistributionItem]
    department_workload: List[DepartmentWorkloadItem]
    sla_status_distribution: List[SLADistributionItem]
    department_processing_time: List[DepartmentProcessingTimeItem]
    industry_processing_time: List[IndustryProcessingTimeItem]
    monthly_application_volume: List[MonthlyVolumeItem]


class BottleneckReportItem(BaseModel):
    department_id: int
    department_code: str
    department_name: str
    is_bottleneck: bool
    flag: str
    observation: str
    pending_clearances: int
    overdue_clearances: int
    average_pending_days: float
    global_benchmark_days: float
    severity: str


class AnalyticsDashboardResponse(BaseModel):
    metrics: AnalyticsMetricsSchema
    charts: AnalyticsChartsSchema
    bottlenecks: List[BottleneckReportItem]
    filters_applied: Dict[str, Any]
    generated_at: Optional[str] = None
