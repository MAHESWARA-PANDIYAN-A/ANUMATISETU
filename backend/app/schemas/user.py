from datetime import datetime
from typing import Any, Optional, Union
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    role: UserRole = UserRole.APPLICANT
    phone: Optional[str] = None
    department: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v: Union[str, Any]) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_name(cls, v: Union[str, Any]) -> str:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("role", mode="before")
    @classmethod
    def clean_role(cls, v: Union[str, Any]) -> UserRole:
        if isinstance(v, str):
            upper_val = v.strip().upper()
            if upper_val in UserRole.__members__:
                return UserRole[upper_val]
        return v

    @field_validator("phone", "department", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            stripped = v.strip()
            return stripped if stripped else None
        return v


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100, description="Password must be at least 6 characters")
    full_name: str = Field(..., min_length=2, max_length=255, description="Full name must be at least 2 characters")
    role: UserRole = UserRole.APPLICANT
    phone: Optional[str] = None
    department: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v):
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("full_name", mode="before")
    @classmethod
    def clean_name(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("role", mode="before")
    @classmethod
    def clean_role(cls, v):
        if isinstance(v, str):
            upper_val = v.strip().upper()
            if upper_val in UserRole.__members__:
                return UserRole[upper_val]
        return v

    @field_validator("phone", "department", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            stripped = v.strip()
            return stripped if stripped else None
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v):
        if isinstance(v, str):
            return v.strip().lower()
        return v


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    department: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    exp: Optional[int] = None
