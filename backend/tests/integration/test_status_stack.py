import os

import pytest
from fastapi.testclient import TestClient

from app.main import app


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_STACK_TESTS") != "1",
    reason="Set RUN_STACK_TESTS=1 with Compose Postgres and MinIO running",
)


def test_status_against_compose_stack():
    client = TestClient(app)
    response = client.get("/v1/status")
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "ok"
    assert body["database"] in {"ok", "unavailable"}
    assert body["storage"] in {"ok", "unavailable"}
    assert body["database"] == "ok"
    assert body["storage"] == "ok"
