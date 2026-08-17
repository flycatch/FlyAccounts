import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.security import issue_access_token
from app.db.session import get_engine, reset_engine
from app.main import app
from tests.conftest import assign_role, create_user, role_by_name


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_STACK_TESTS") != "1",
    reason="Set RUN_STACK_TESTS=1 with Compose Postgres and MinIO running",
)


def test_status_against_compose_stack():
    get_settings.cache_clear()
    reset_engine()
    factory = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    db: Session = factory()
    try:
        user = create_user(db, upn="stack-status@contoso.com")
        assign_role(db, user, role_by_name(db, "Operator"))
        db.commit()
        token = issue_access_token(user.id)
    finally:
        db.close()

    client = TestClient(app)
    response = client.get("/v1/status", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "ok"
    assert body["database"] in {"ok", "unavailable"}
    assert body["storage"] in {"ok", "unavailable"}
    assert body["database"] == "ok"
    assert body["storage"] == "ok"
