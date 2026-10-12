
from datetime import datetime, timedelta, timezone

import jwt

from auth import SECRET_KEY, ALGORITHM


def register_user(client, email, password="TestPassword123!"):
    response = client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    assert response.status_code == 201
    return response


def login_user(client, email, password="TestPassword123!"):
    response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200

    return {
        "Authorization": f"Bearer {response.json()['access_token']}"
    }


def sample_application(company):
    return {
        "company": company,
        "job_title": "Software Engineer",
        "status": "Applied",
        "application_date": "2026-10-11",
        "job_url": "https://example.com",
        "notes": "Private application",
    }


def test_register_user(client):
    response = register_user(client, "new@example.com")

    assert response.json()["email"] == "new@example.com"
    assert "hashed_password" not in response.json()


def test_duplicate_registration(client):
    register_user(client, "duplicate@example.com")

    response = client.post(
        "/auth/register",
        json={
            "email": "duplicate@example.com",
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 409


def test_login_success(client):
    register_user(client, "login@example.com")

    response = client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client):
    register_user(client, "wrong@example.com")

    response = client.post(
        "/auth/login",
        json={
            "email": "wrong@example.com",
            "password": "IncorrectPassword123!",
        },
    )

    assert response.status_code == 401


def test_unauthorized_access(client):
    response = client.get("/applications")

    assert response.status_code == 401


def test_invalid_token(client):
    response = client.get(
        "/applications",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401


def test_expired_token(client):
    register_user(client, "expired@example.com")
    headers = login_user(client, "expired@example.com")

    user_response = client.get("/auth/me", headers=headers)
    assert user_response.status_code == 200

    user_id = user_response.json()["id"]

    expired_token = jwt.encode(
        {
            "sub": str(user_id),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    response = client.get(
        "/applications",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401


def test_users_cannot_access_each_others_applications(client):
    # Register two independent users
    register_user(client, "user1@example.com")
    register_user(client, "user2@example.com")

    user1_headers = login_user(client, "user1@example.com")
    user2_headers = login_user(client, "user2@example.com")

    # User 1 creates a private application
    created = client.post(
        "/applications",
        json=sample_application("Fortinet"),
        headers=user1_headers,
    )

    assert created.status_code == 201
    application_id = created.json()["id"]

    # User 2 cannot see it in their list
    user2_list = client.get(
        "/applications",
        headers=user2_headers,
    )

    assert user2_list.status_code == 200
    assert user2_list.json() == []

    # User 2 cannot retrieve it directly
    response = client.get(
        f"/applications/{application_id}",
        headers=user2_headers,
    )
    assert response.status_code == 404

    # User 2 cannot modify it
    response = client.put(
        f"/applications/{application_id}",
        json={"status": "Rejected"},
        headers=user2_headers,
    )
    assert response.status_code == 404

    # User 2 cannot delete it
    response = client.delete(
        f"/applications/{application_id}",
        headers=user2_headers,
    )
    assert response.status_code == 404

    # User 1 still owns the unchanged application
    response = client.get(
        f"/applications/{application_id}",
        headers=user1_headers,
    )

    assert response.status_code == 200
    assert response.json()["company"] == "Fortinet"
    assert response.json()["status"] == "Applied"
