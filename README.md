# ApplyPilot Lite

A full-stack job application tracker. Users create an account, track their
job applications on a dashboard, and use an AI Resume Matcher (OpenAI) to
compare their resume against a job description.

**Tech stack:** React, TypeScript, Vite · FastAPI, SQLAlchemy, Alembic ·
PostgreSQL · Docker Compose · Caddy · GitHub Actions · AWS EC2 · Cloudflare Pages

## Features

- Registration and login with Argon2-hashed passwords and JWT access tokens
- Each user can only see and edit their own job applications
- Dashboard with create, edit, delete, filtering and statistics
- AI Resume Matcher, limited to 5 requests per user per day
- Login and registration rate limiting (10 attempts per minute per IP)

## Architecture

```
Browser ──HTTPS──> Cloudflare Pages (React build)
   │
   └──HTTPS──> Caddy (EC2, automatic Let's Encrypt certificate)
                 └──> FastAPI (Docker network only)
                        └──> PostgreSQL (Docker network only)
```

Only Caddy is reachable from the internet. The OpenAI key, JWT secret and
database password stay on the server in a git-ignored `.env` file.

## Running locally

**Backend**

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@localhost:5432/applypilot_db
TEST_DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@localhost:5432/applypilot_test_db
JWT_SECRET_KEY=<random string>
OPENAI_API_KEY=<your key>
```

```powershell
alembic upgrade head
uvicorn main:app --reload        # http://127.0.0.1:8000/docs
python -m pytest tests/ -v
```

**Frontend**

```powershell
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

**Or run the backend and database with Docker**

```powershell
copy .env.example .env.docker    # fill in real values
docker compose --env-file .env.docker up -d --build    # http://127.0.0.1:8001
```

## Deployment

**Backend (AWS EC2).** The security group allows inbound TCP 80 and 443
from anywhere and SSH from my IP only. On the server:

```bash
git clone https://github.com/AliRasouli2000/applypilot-lite.git
cd applypilot-lite
cp .env.example .env && chmod 600 .env    # fill in real values
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` adds Caddy, which handles HTTPS for `API_DOMAIN`.
Database migrations run automatically when the backend starts.

**Frontend (Cloudflare Pages).** Connect the GitHub repository and use root
directory `frontend`, build command `npm run build`, output directory `dist`
and environment variable `VITE_API_URL=https://<API_DOMAIN>`. Every push to
`main` redeploys. Put the Pages URL in `CORS_ORIGINS` in the server's `.env`.

**Database backup**

```bash
docker compose exec -T db pg_dump -U applypilot -Fc applypilot_docker_db > backup.dump
```

## CI

GitHub Actions runs the backend tests against PostgreSQL, plus frontend lint
and build, on every push and pull request.
