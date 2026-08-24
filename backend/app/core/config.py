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
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    frontend_url: str = ""

    # Proforma invoice letterhead (company contact + bank). Empty when unset.
    proforma_company_address_line1: str = ""
    proforma_company_address_line2: str = ""
    proforma_company_city: str = ""
    proforma_company_state: str = ""
    proforma_company_postal_code: str = ""
    proforma_company_country: str = ""
    proforma_company_phone: str = ""
    proforma_company_email: str = ""
    proforma_account_name: str = ""
    proforma_account_number: str = ""
    proforma_iban: str = ""
    proforma_bank_name: str = ""
    proforma_bank_address: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def public_frontend_url(self) -> str:
        if self.frontend_url.strip():
            return self.frontend_url.strip().rstrip("/")
        origins = self.cors_origin_list
        if origins:
            return origins[0].rstrip("/")
        return ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
