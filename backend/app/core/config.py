from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: str = "postgresql+psycopg://flyaccounts:changeme@postgres:5432/flyaccounts"
    s3_endpoint: str = "http://minio:9000"
    s3_region: str = "us-east-1"
    s3_bucket: str = "flyaccounts"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    cors_origins: str = "http://localhost:8080"
    openapi_path: str = "/app/contracts/openapi.yaml"
    microsoft_tenant_id: str = ""
    microsoft_client_id: str = ""
    initial_admin_email: str = ""
    jwt_signing_key: str = "change-me"
    jwt_access_ttl_seconds: int = 900
    jwt_refresh_ttl_seconds: int = 604800

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
