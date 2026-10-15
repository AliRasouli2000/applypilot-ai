# ApplyPilot AI

A full-stack job application tracker. Users create an account, track their
job applications on a dashboard, and use an AI Resume Matcher (OpenAI) to
compare their resume against a job description.

**Live demo:** https://applypilot-lite.pages.dev

**Tech stack:** React, TypeScript, Vite · FastAPI, SQLAlchemy, Alembic ·
PostgreSQL · Docker Compose · Caddy · GitHub Actions · AWS EC2 · Cloudflare Pages

## Features

- Registration and login with Argon2-hashed passwords and JWT access tokens
- Each user can only see and edit their own job applications
- Dashboard with create, edit, delete, search, status filters and statistics
- AI Resume Matcher with a match score, matched and missing skills,
  strengths and improvement suggestions
- 5 AI analyses per user per UTC day, enforced by the backend. The matcher
  shows how many remain (from `GET /ai/usage`) and resets at 00:00 UTC
- Responsive interface for desktop, tablet and mobile, with light and dark
  themes that follow the system setting
- Login and registration rate limiting (10 attempts per minute per IP)
- CI/CD: every push to `main` is tested, and commits that pass are deployed
  automatically (frontend to Cloudflare Pages, backend to AWS EC2)

## Architecture

```
Browser ──HTTPS──> Cloudflare Pages (React build)
   │
   └──HTTPS──> Caddy (EC2, automatic Let's Encrypt certificate)
                 └──> FastAPI (Docker network only)
                        └──> PostgreSQL (Docker network only)

GitHub ──> GitHub Actions CI (tests) ──> EC2 pulls and deploys commits that pass
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

**Automatic backend deployment.** Install the deploy timer once (see
CI/CD below). On a server that is already running, first record the commit
the running backend was built from, so the first automatic run knows what
changed:

```bash
mkdir -p ~/.local/state/applypilot
git rev-parse HEAD > ~/.local/state/applypilot/deployed_sha

sudo cp deploy/systemd/applypilot-autodeploy.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now applypilot-autodeploy.timer
```

## CI/CD

```
push to main
  -> CI workflow: backend tests (pytest + PostgreSQL), frontend lint + build
  -> Cloudflare Pages builds and deploys the frontend
  -> EC2 timer (every 2 min) finds the newest commit that passed CI,
     fast-forwards to it and, if backend files changed, rebuilds
     only the backend container
  -> Deploy workflow confirms /health reports that commit and
     /health/db reaches the database
```

- **CI** ([ci.yml](.github/workflows/ci.yml)) runs on every push and pull
  request: 34 backend tests against PostgreSQL, frontend lint and a production
  build. It has read-only permissions and pins every action to a commit SHA.
- **Deployment is pull-based.** The server runs
  [deploy/auto-deploy.sh](deploy/auto-deploy.sh) from a systemd timer. It asks
  GitHub's public API for the latest successful CI run on `main` and deploys
  exactly that commit, even if newer commits are still being tested. Commits
  that fail CI, pull requests and forks are never deployed, and a commit that
  tracks a `.env` file is refused so production secrets can't be overwritten.
- **No inbound access or secrets.** GitHub never connects to the server and no
  deployment credentials exist. SSH stays limited to my IP.
- **Only the backend restarts.** `docker compose up -d --build --no-deps
  backend` builds the new image while the old container keeps running, then
  swaps them. PostgreSQL, Caddy, volumes and `.env` are untouched. Caddy holds
  requests for up to 30 seconds during the swap. Migrations run on startup.
- **Verification** ([deploy.yml](.github/workflows/deploy.yml)) runs after CI
  passes on `main`. The backend image records its commit, and `GET /health`
  reports it (`{"status":"healthy","version":"<commit sha>"}`), so the
  workflow can confirm the right code is live before checking `/health/db`.
- **Timing:** a push is usually live about 4 to 5 minutes later (about 2
  minutes for CI, up to 2 minutes until the next server check, under a
  minute to rebuild).
- **Failures** are logged on the server (`journalctl -u
  applypilot-autodeploy`) and the Deploy workflow fails. A failed commit is not
  retried; the next commit that passes CI is deployed. There is no automatic
  rollback.
- **Not deployed automatically:** changes to `docker-compose.prod.yml` or
  `deploy/Caddyfile`. Apply those by hand with
  `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`, then
  `docker compose -f docker-compose.yml -f docker-compose.prod.yml restart caddy`
  for Caddyfile changes.

**Check deployment status:**

- GitHub: the **Actions** tab shows each **CI** run followed by a **Deploy**
  run with a summary. The repository's **Deployments → production** panel
  shows the commit that is live.
- Live version: `curl https://applypilot-api.duckdns.org/health`
- Server log: `journalctl -u applypilot-autodeploy`

**Pause automatic deployment:**
`sudo systemctl disable --now applypilot-autodeploy.timer`
(turn it back on with `enable --now`).

**Retry a failed commit:**
`rm ~/.local/state/applypilot/failed_sha && sudo systemctl start applypilot-autodeploy`
