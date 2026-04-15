# Home Tasks Manager

A family task scheduler with a day-view grid. Family members appear as columns; tasks are placed in time slots and displayed as color-coded cards proportional to their duration. The backend fires real-time alarm notifications N minutes before each task's scheduled time.

## Features

- Day-view schedule grid — one column per family member, one row per hour (00:00–23:00)
- Task cards inherit the member's color with duration-proportional height
- Real-time alarm popups via SSE — each popup is styled with the member's color
- Add / delete tasks and members; all changes propagate instantly to connected tabs
- SQLite persistence — data survives container restarts

## Stack

| Layer | Technology |
|---|---|
| Backend | Rust · Axum 0.7 · SQLite (sqlx) · SSE |
| Frontend | React 19 · Vite · Tailwind CSS 3 |
| Infrastructure | Docker Compose · nginx reverse proxy |

## Quick Start (Docker)

```bash
# Build and start both services
docker compose up --build

# App is available at http://localhost:80
```

Data is persisted in a Docker named volume (`tasks-data`). To reset the database:

```bash
docker compose down -v
```

### Convenience scripts

```bash
scripts/build.sh    # docker compose up --build -d
scripts/start.sh    # docker compose up -d
scripts/stop.sh     # docker compose down
scripts/status.sh   # docker compose ps
```

## Local Development (without Docker)

### Backend

```bash
cd backend
cargo run
# Server listens on http://localhost:3000
# SQLite database created at ./tasks.db
```

```bash
RUST_LOG=debug cargo run          # verbose logging
DATABASE_URL=sqlite:/tmp/dev.db cargo run   # custom DB path
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Dev server with HMR at http://localhost:5173
```

`frontend/.env.local` is pre-configured with `VITE_API_BASE=http://localhost:3000` so the dev server talks directly to the backend.

```bash
npm run build    # production bundle → dist/
npm run lint     # ESLint
```

## API

All endpoints are served under `/api/`.

### Members

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/members` | List all members |
| `POST` | `/api/members` | Create a member `{ name, color }` |
| `DELETE` | `/api/members/:id` | Delete a member and all their tasks |

### Tasks

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/tasks?date=YYYY-MM-DD` | List tasks for a date |
| `POST` | `/api/tasks` | Create a task (see body below) |
| `DELETE` | `/api/tasks/:id` | Delete a task |

**POST /api/tasks body:**
```json
{
  "member_id": "uuid",
  "description": "Take out the trash",
  "scheduled_at": "2026-04-15T09:00:00",
  "duration_minutes": 30,
  "alarm_minutes": 15
}
```

### Events (SSE)

| Path | Description |
|---|---|
| `GET /events` | SSE stream — receives `tasks_changed` and `alarm` events |

**Event shapes:**
```json
{ "type": "tasks_changed" }
{ "type": "alarm", "task": { ...task object... } }
```

## Architecture Notes

- **nginx** in the frontend container reverse-proxies `/api/*` and `/events` to the backend on the internal Docker network. Uses Docker's internal DNS resolver (`127.0.0.11`) with a `set $backend` variable so the proxy survives backend restarts.
- **SSE** is invalidation-only — `tasks_changed` tells the browser to refetch all data; it does not carry a diff.
- **Alarms** are one-shot — once fired (`alarm_fired = 1`), a task never fires again. To re-arm, delete and recreate the task.
- **Timezone** — the backend container inherits the host's timezone via `/etc/localtime` mount and `TZ` env var. Tasks are stored and compared as naive local datetimes.
- **No auth** — designed for trusted home-network use only.
