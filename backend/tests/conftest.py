import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    get_settings.cache_clear()
    monkeypatch.setenv(
        "OPENAPI_PATH",
        str(__import__("pathlib").Path(__file__).resolve().parents[1] / "contracts" / "openapi.yaml"),
    )
    get_settings.cache_clear()
    return TestClient(app)
