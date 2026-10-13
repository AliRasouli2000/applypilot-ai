from rate_limit import auth_limiter


def test_login_is_rate_limited(client):
    payload = {"email": "nobody@example.com", "password": "WrongPassword123!"}

    for _ in range(auth_limiter.limit):
        response = client.post("/auth/login", json=payload)
        assert response.status_code == 401

    response = client.post("/auth/login", json=payload)

    assert response.status_code == 429
    assert "Retry-After" in response.headers


def test_cors_allows_configured_origin(client):
    response = client.options(
        "/applications",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert (
        response.headers["access-control-allow-origin"]
        == "http://localhost:5173"
    )


def test_cors_rejects_unknown_origin(client):
    response = client.options(
        "/applications",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert "access-control-allow-origin" not in response.headers
