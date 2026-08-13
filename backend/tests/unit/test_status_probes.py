from app.db.session import check_database
from app.storage.s3 import check_storage


def test_database_ok(monkeypatch):
    class FakeConn:
        def execute(self, _stmt):
            return None

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    class FakeEngine:
        def connect(self):
            return FakeConn()

    monkeypatch.setattr("app.db.session.get_engine", lambda: FakeEngine())
    assert check_database() == "ok"


def test_database_unavailable(monkeypatch):
    class FakeEngine:
        def connect(self):
            raise RuntimeError("down")

    monkeypatch.setattr("app.db.session.get_engine", lambda: FakeEngine())
    assert check_database() == "unavailable"


def test_storage_ok(monkeypatch):
    class FakeClient:
        def head_bucket(self, Bucket):
            return {}

    monkeypatch.setattr("app.storage.s3._client", lambda: FakeClient())
    assert check_storage() == "ok"


def test_storage_unavailable(monkeypatch):
    class FakeClient:
        def head_bucket(self, Bucket):
            raise RuntimeError("down")

    monkeypatch.setattr("app.storage.s3._client", lambda: FakeClient())
    assert check_storage() == "unavailable"
