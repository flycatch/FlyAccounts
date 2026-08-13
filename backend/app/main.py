from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.status import router as status_router
from app.core.config import get_settings
from app.core.telemetry import setup_telemetry
from app.storage.s3 import ensure_bucket


def _committed_openapi() -> dict:
    settings = get_settings()
    candidates = [
        Path(settings.openapi_path),
        Path(__file__).resolve().parents[1] / "contracts" / "openapi.yaml",
        Path(__file__).resolve().parents[2]
        / "specs"
        / "001-app-foundation"
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
    application = FastAPI(title="FlyAccounts", version="1.0.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    application.include_router(status_router, prefix="/v1")
    setup_telemetry(application)

    committed = _committed_openapi()
    application.openapi = lambda: committed  # type: ignore[method-assign]
    return application


app = create_app()
