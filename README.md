# ApplyPilot Lite

AI-powered job application tracker. Users register, track their job
applications on a dashboard, and compare a resume against a job description
with an OpenAI-backed Resume Matcher (limited to 5 requests per user per day).

- **Frontend:** React, TypeScript, Vite, hosted on Cloudflare Pages
- **Backend:** FastAPI, SQLAlchemy, Alembic, PostgreSQL 18
- **Auth:** JWT bearer tokens (kept in memory in the browser, not localStorage)
- **Hosting:** AWS EC2 (Docker Compose) behind a Caddy HTTPS reverse proxy

## Architecture

```
Browser ──HTTPS──> Cloudflare Pages (static React build)
   │
   └──HTTPS──> Caddy :443 (EC2, automatic Let's Encrypt certificates)
                  └──> FastAPI :8000 (Docker network only)
                          └──> PostgreSQL :5432 (Docker network only)
```

Only ports 80 (redirects to HTTPS), 443 and SSH are reachable from the
internet. FastAPI is also bound to `127.0.0.1:8001` for health checks from the
host. PostgreSQL has no published port.

## Local development

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env` (it is git-ignored):

```
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@localhost:5432/applypilot_db
TEST_DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@localhost:5432/applypilot_test_db
JWT_SECRET_KEY=<random string>
OPENAI_API_KEY=<your key>
OPENAI_MODEL=gpt-4.1-mini
```

```powershell
alembic upgrade head
uvicorn main:app --reload        # http://127.0.0.1:8000
python -m pytest tests/ -v       # needs the applypilot_test_db database
```

### Frontend

```powershell
cd frontend
npm install
npm run dev                      # http://localhost:5173, uses http://127.0.0.1:8000
```

Set `VITE_API_URL` to point at a different backend. Production builds
(`npm run build`) fail unless `VITE_API_URL` is an `https://` URL.

### Full stack with Docker

```powershell
copy .env.example .env.docker    # then fill in real values
docker compose --env-file .env.docker up -d --build   # API on http://127.0.0.1:8001
```

## Configuration

Backend environment variables (set in `.env` next to `docker-compose.yml`
in production; see [.env.example](.env.example)):

| Variable | Purpose |
| --- | --- |
| `DOCKER_DB_PASSWORD` | PostgreSQL password |
| `DOCKER_JWT_SECRET_KEY` | JWT signing key |
| `OPENAI_API_KEY` | OpenAI key (server-side only, never sent to the browser) |
| `OPENAI_MODEL` | Defaults to `gpt-4.1-mini` |
| `API_DOMAIN` | Public backend hostname, used by Caddy for TLS |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `ENABLE_DOCS` | `false` disables `/docs`, `/redoc` and `/openapi.json` |
| `AUTH_RATE_LIMIT` / `AUTH_RATE_WINDOW_SECONDS` | Login/register attempts per IP (default 10 per 60 s) |

Frontend build variable: `VITE_API_URL`, the public backend URL. It is the
only value baked into the browser bundle. Never put secrets in `VITE_*`
variables.

Generate secrets with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Production deployment

### 1. Backend on EC2

Prerequisites: Docker with the Compose plugin, a DNS name pointing at the
instance (for example a free DuckDNS subdomain), and a security group allowing
inbound TCP 80 and 443 from anywhere, with SSH limited to your IP.

```bash
git clone https://github.com/AliRasouli2000/applypilot-lite.git
cd applypilot-lite
cp .env.example .env && chmod 600 .env    # fill in real values
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
curl https://$API_DOMAIN/health/db
```

Caddy obtains and renews the TLS certificate automatically. Database
migrations run on backend startup (`alembic upgrade head`).

### 2. Frontend on Cloudflare Pages

Connect the GitHub repository in the Cloudflare dashboard
(Workers & Pages → Create → Pages → Connect to Git) with:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `VITE_API_URL=https://<api-domain>` |

Every push to `main` redeploys. The build emits a `_headers` file with a
Content Security Policy that only allows API calls to `VITE_API_URL`.
Then add the Pages URL to `CORS_ORIGINS` on the server and run
`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.

### 3. Backups, monitoring and updates (EC2)

```bash
sudo cp deploy/systemd/applypilot-*.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now applypilot-backup.timer applypilot-healthcheck.timer
```

- **Backups:** [deploy/backup.sh](deploy/backup.sh) runs daily at 03:30 UTC
  and writes a `pg_dump` archive to `~/backups` with owner-only permissions.
  Each archive is read back with `pg_restore --list` to check it. Archives
  older than 14 days are deleted. These backups live on the same disk as the
  database, so they don't protect against losing the instance or its volume.
  Copy them off the server regularly, or take EBS snapshots.
- **Restore:**
  `docker compose exec -T db pg_restore -U applypilot -d applypilot_docker_db --clean --if-exists < ~/backups/<file>.dump`
- **Health check:** [deploy/healthcheck.sh](deploy/healthcheck.sh) runs every
  5 minutes. After 3 consecutive failures it restarts only the affected
  service (backend or Caddy). It waits 30 minutes between restarts, makes at
  most 3 restarts a day, and never restarts the database. Logs:
  `journalctl -t applypilot`.
- **Security updates:** `dnf-automatic` applies security updates only.
  Docker, containerd and runc are excluded, and the server never reboots
  automatically. Update those by hand during a maintenance window.

### Updating the backend

```bash
cd ~/applypilot-lite
~/applypilot-lite/deploy/backup.sh
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Security notes

- Secrets live only in git-ignored `.env` files on each machine. They are
  never committed, and none are baked into the frontend.
- Login and registration are rate-limited per client IP. The AI matcher is
  limited per user per day.
- CORS allows only the configured frontend origins. Bearer tokens are used
  instead of cookies.
- Caddy caps request bodies at 1 MB and adds HSTS and other security headers.

## CI

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the
backend test suite against PostgreSQL 18, plus frontend lint and a production
build, on every push and pull request.
