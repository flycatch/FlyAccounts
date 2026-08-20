from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.clients import router as clients_router
from app.api.contracts import router as contracts_router
from app.api.entities import router as entities_router
from app.api.me import router as me_router
from app.api.people import router as people_router
from app.api.permissions import router as permissions_router
from app.api.resources import router as resources_router
from app.api.roles import router as roles_router
from app.api.status import router as status_router
from app.core.config import get_settings
from app.core.errors import ApiError, api_error_handler
from app.core.telemetry import setup_telemetry
from app.storage.s3 import ensure_bucket


def _committed_openapi() -> dict:
    settings = get_settings()
    candidates = [
        Path(settings.openapi_path),
        Path(__file__).resolve().parents[1] / "contracts" / "openapi.yaml",
        Path(__file__).resolve().parents[2]
        / "specs"
        / "005-contracts-module"
        / "contracts"
        / "openapi.yaml",
    ]
    for path in candidates:
        if path.is_file():
            return yaml.safe_load(path.read_text(encoding="utf-8"))
    raise FileNotFoundError("Committed OpenAPI document not found")


@asynccontextmanager
async def lifespan(_application: FastAPI):
    try:
        ensure_bucket()
    except Exception:
        pass
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title="FlyAccounts", version="7.0.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["*"],
    )
    application.include_router(status_router, prefix="/v1")
    application.include_router(auth_router, prefix="/v1")
    application.include_router(me_router, prefix="/v1")
    application.include_router(people_router, prefix="/v1")
    application.include_router(roles_router, prefix="/v1")
    application.include_router(permissions_router, prefix="/v1")
    application.include_router(entities_router, prefix="/v1")
    application.include_router(clients_router, prefix="/v1")
    application.include_router(resources_router, prefix="/v1")
    application.include_router(contracts_router, prefix="/v1")
    application.add_exception_handler(ApiError, api_error_handler)
    setup_telemetry(application)

    committed = _committed_openapi()
    application.openapi = lambda: committed  # type: ignore[method-assign]
    return application


app = create_app()
