import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SIH26130 Industrial Approvals & Compliance Intelligence Platform"
    API_V1_STR: str = "/api/v1"
    
    # Database Configuration
    DATABASE_URL: str = "postgresql://postgres:1234@localhost:5432/sih_industrial_db"

    # Security & Tokens
    JWT_SECRET: str = "sih26130_super_secret_jwt_encryption_key_2026_industrial_platform"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Cloudinary Document Storage Configuration
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_URL: str = ""
    CLOUDINARY_FOLDER: str = "tasker/documents"
    CLOUDINARY_SECURE: bool = True
    CLOUDINARY_ASSET_TYPE: str = "authenticated"  # authenticated / private / upload
    
    # Document Constraints
    MAX_DOCUMENT_SIZE_MB: int = 5
    ALLOWED_DOCUMENT_TYPES: str = "pdf,jpg,jpeg,png"

    # xAI / Grok AI Integration
    XAI_API_KEY: str = ""
    XAI_MODEL: str = "grok-4.7"
    XAI_BASE_URL: str = "https://api.x.ai/v1"

    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GROK_API_KEY: str = ""

    @property
    def ACTIVE_XAI_KEY(self) -> str:
        return (self.XAI_API_KEY or self.GROK_API_KEY or self.GROQ_API_KEY or "").strip()

    @property
    def ACTIVE_GROQ_KEY(self) -> str:
        return (self.GROQ_API_KEY or self.GROK_API_KEY or self.XAI_API_KEY or "").strip()

    @property
    def IS_CLOUDINARY_CONFIGURED(self) -> bool:
        return bool(self.CLOUDINARY_URL or (self.CLOUDINARY_CLOUD_NAME and self.CLOUDINARY_API_KEY and self.CLOUDINARY_API_SECRET))

    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                return json.loads(v)
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        return []

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
