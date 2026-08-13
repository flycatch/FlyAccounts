from pathlib import Path

import yaml


def test_status_matches_openapi_contract(client, monkeypatch):
    monkeypatch.setattr("app.api.status.check_database", lambda: "ok")
    monkeypatch.setattr("app.api.status.check_storage", lambda: "ok")

    spec_path = (
        Path(__file__).resolve().parents[3]
        / "specs"
        / "001-app-foundation"
        / "contracts"
        / "openapi.yaml"
    )
    spec = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    schema = spec["components"]["schemas"]["StatusResponse"]

    response = client.get("/v1/status")
    assert response.status_code == 200
    body = response.json()

    assert set(schema["required"]) <= set(body.keys())
    assert set(body.keys()) == {"service", "database", "storage"}
    assert body["service"] in schema["properties"]["service"]["enum"]
    assert body["database"] in schema["properties"]["database"]["enum"]
    assert body["storage"] in schema["properties"]["storage"]["enum"]
    assert schema["additionalProperties"] is False
