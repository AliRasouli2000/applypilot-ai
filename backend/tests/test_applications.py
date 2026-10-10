
def sample_application():
    return {
        "company": "Fortinet",
        "job_title": "Junior Software Engineer",
        "status": "Applied",
        "application_date": "2026-10-09",
        "job_url": "https://example.com/job",
        "notes": "Automated test",
    }


def test_create_application(client):
    response = client.post(
        "/applications",
        json=sample_application(),
    )

    assert response.status_code == 201
    assert response.json()["company"] == "Fortinet"
    assert "id" in response.json()


def test_list_applications(client):
    client.post("/applications", json=sample_application())

    response = client.get("/applications")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_get_application(client):
    created = client.post(
        "/applications",
        json=sample_application(),
    ).json()

    response = client.get(f"/applications/{created['id']}")

    assert response.status_code == 200
    assert response.json()["job_title"] == "Junior Software Engineer"


def test_update_application(client):
    created = client.post(
        "/applications",
        json=sample_application(),
    ).json()

    response = client.put(
        f"/applications/{created['id']}",
        json={"status": "Interviewing"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "Interviewing"


def test_delete_application(client):
    created = client.post(
        "/applications",
        json=sample_application(),
    ).json()

    response = client.delete(f"/applications/{created['id']}")

    assert response.status_code == 204

    check = client.get(f"/applications/{created['id']}")
    assert check.status_code == 404
