def test_health_reports_status_and_version(client, monkeypatch):
    monkeypatch.setenv("APP_VERSION", "abc123")

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "version": "abc123"}


def test_health_version_defaults_to_dev(client, monkeypatch):
    monkeypatch.delenv("APP_VERSION", raising=False)

    assert client.get("/health").json()["version"] == "dev"


def test_health_db_checks_database(client):
    response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {"database": "connected"}
