
import pytest


def sample_application():
    return {
        "company": "Fortinet",
        "job_title": "Software Engineer",
        "status": "Applied",
        "application_date": "2026-10-11",
        "job_url": "https://www.fortinet.com",
        "notes": "Testing authenticated CRUD",
    }


@pytest.fixture
def auth_headers(client):
    # Register a test user
    registration = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "password": "TestPassword123!",
        },
    )
    assert registration.status_code == 201

    # Log in and obtain a JWT
    login = client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
            "password": "TestPassword123!",
        },
    )
    assert login.status_code == 200

    token = login.json()["access_token"]

    return {"Authorization": f"Bearer {token}"}


def test_create_application(client, auth_headers):
    response = client.post(
        "/applications",
        json=sample_application(),
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json()["company"] == "Fortinet"
    assert response.json()["job_title"] == "Software Engineer"
    assert "id" in response.json()


def test_list_applications(client, auth_headers):
    created = client.post(
        "/applications",
        json=sample_application(),
        headers=auth_headers,
    )
    assert created.status_code == 201

    response = client.get(
        "/applications",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["company"] == "Fortinet"


def test_get_application(client, auth_headers):
    created = client.post(
        "/applications",
        json=sample_application(),
        headers=auth_headers,
    )
    assert created.status_code == 201

    application_id = created.json()["id"]

    response = client.get(
        f"/applications/{application_id}",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == application_id


def test_update_application(client, auth_headers):
    created = client.post(
        "/applications",
        json=sample_application(),
        headers=auth_headers,
    )
    assert created.status_code == 201

    application_id = created.json()["id"]

    response = client.put(
        f"/applications/{application_id}",
        json={"status": "Interviewing"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "Interviewing"


def test_delete_application(client, auth_headers):
    created = client.post(
        "/applications",
        json=sample_application(),
        headers=auth_headers,
    )
    assert created.status_code == 201

    application_id = created.json()["id"]

    response = client.delete(
        f"/applications/{application_id}",
        headers=auth_headers,
    )

    assert response.status_code == 204

    check = client.get(
        f"/applications/{application_id}",
        headers=auth_headers,
    )

    assert check.status_code == 404
