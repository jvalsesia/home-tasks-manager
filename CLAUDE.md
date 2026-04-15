# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Home family task manager. Family members are displayed as columns in a day-view grid; tasks are placed in 30-minute time slots. The backend fires SSE alarms N minutes before each task's scheduled time.

Two independent sub-projects:

- `backend/` — Rust / Axum REST API + SSE, listens on `:3000`
- `frontend/` — React 19 / Vite / Tailwind CSS, dev server on `:5173`

---

## Docker

```bash
# Build and start both services
docker compose up --build

# App available at http://localhost:80
# SQLite data persisted in the `tasks-data` named volume
```

nginx in the frontend container reverse-proxies `/api/*` and `/events` to the backend container on the internal Docker network. The backend is not exposed on the host. `VITE_API_BASE` is intentionally unset during the Docker build so the frontend uses relative URLs.

For local dev (outside Docker), `frontend/.env.local` sets `VITE_API_BASE=http://localhost:3000` so Vite can reach the backend directly. This file is excluded from the Docker build context via `.dockerignore`.

---

## Commands

### Backend

```bash
cd backend
cargo build            # compile (debug)
cargo run              # start server (sqlite:tasks.db in cwd)
RUST_LOG=debug cargo run   # verbose logging
DATABASE_URL=sqlite:/tmp/test.db cargo run   # custom db path
```

No test suite yet. `cargo check` is the fastest way to validate changes without a full build.

### Frontend

```bash
cd frontend
npm run dev            # Vite dev server with HMR
npm run build          # production bundle → dist/
npm run lint           # ESLint
npm run preview        # serve the production build locally
```

---

## Architecture

### Data flow

```
Browser ──REST──► Axum handlers ──► SQLite
        ◄──SSE── broadcast::Sender ◄── alarm ticker (tokio task)
```

Every mutating handler (create/delete task or member) calls `tx.send(SseEvent::TasksChanged)` on the shared broadcast channel. The SSE endpoint streams whatever is sent into that channel to every connected browser tab. The alarm ticker is a separate `tokio::spawn` loop that runs every 30 s.

### Backend (`backend/src/`)

| File | Role |
|---|---|
| `main.rs` | Router setup, `AppState` definition, server bootstrap |
| `models.rs` | `Member`, `Task` (sqlx `FromRow`), `CreateMemberRequest`, `CreateTaskRequest`, `SseEvent` enum |
| `db.rs` | Pool init + inline `CREATE TABLE IF NOT EXISTS` migrations (no migration files) |
| `alarm.rs` | `spawn_alarm_ticker` — queries tasks where `alarm_fired=0` and `scheduled_at - alarm_minutes <= now < scheduled_at`, fires SSE, sets `alarm_fired=1` |
| `routes/members.rs` | `GET/POST /api/members`, `DELETE /api/members/:id` |
| `routes/tasks.rs` | `GET /api/tasks?date=&member_id=`, `POST /api/tasks`, `DELETE /api/tasks/:id` |
| `routes/events.rs` | `GET /events` — subscribes to broadcast channel, streams as SSE via `BroadcastStream` |

**`AppState`** is `Clone` and holds the `SqlitePool` and `broadcast::Sender<SseEvent>`. It is injected into every handler via Axum's `State` extractor.

**SQLite schema** — `tasks.scheduled_at` is stored as `TEXT` in `"YYYY-MM-DDTHH:MM:SS"` format. SQLite's `datetime()` function is used directly in alarm queries. Booleans are stored as `INTEGER` (0/1); `alarm_fired` is the key idempotency guard. `duration_minutes` defaults to 30 and has no upper bound enforced at the DB level.

**`SseEvent`** is a tagged enum serialized with `#[serde(tag = "type", rename_all = "snake_case")]`, so the browser receives `{ "type": "tasks_changed" }` or `{ "type": "alarm", "task": {...} }`.

### Frontend (`frontend/src/`)

| File | Role |
|---|---|
| `api.js` | All `fetch` calls. `BASE = http://localhost:3000`. Functions: `fetchMembers`, `createMember`, `deleteMember`, `fetchTasks`, `createTask`, `deleteTask` |
| `hooks/useSSE.js` | Opens one `EventSource` per app mount, auto-reconnects after 3 s on error, uses a `ref` so the latest handler is always called without restarting the connection |
| `App.jsx` | Owns all state: `members`, `tasks`, `selectedDate`, `alarms`. Wires `useSSE` → `loadMembers` / `loadTasks` on `tasks_changed`; pushes deduped `{ task, memberName, memberColor }` entries into `alarms` on `alarm` events |
| `components/TaskGrid.jsx` | Fixed 24-hour grid (00:00–23:00, one row per hour). Builds `slotMap[HH:00][memberId][]` from tasks — any task scheduled within an hour lands in that hour's row regardless of minutes. Grid columns use `style={{ gridTemplateColumns }}` (inline, not a Tailwind class) because the column count is dynamic and cannot be safelisted at build time. |
| `components/TaskCard.jsx` | Shows description, time, duration (`⏱ 30m / 1h / 1h 30m`), alarm badge; delete button appears on hover |
| `components/AddTaskModal.jsx` | Sends `"YYYY-MM-DDTHH:MM:SS"` to backend. Date is locked to `selectedDate` from App. Duration and Alarm fields share a row. |
| `components/ManageMembers.jsx` | Create member with preset hex colors + custom color input; delete with cascade warning |
| `components/AlarmBanner.jsx` | Centered modal popups with per-alarm member color. Backdrop dismisses all; each card has a colored header and a "Got it" button. |

### Known pitfalls

**Adding a column to an existing SQLite database requires a guarded `ALTER TABLE`.**
The inline migrations use `CREATE TABLE IF NOT EXISTS`, so new columns added after the initial schema are not automatically applied to existing databases. The pattern used here is: query `pragma_table_info('tasks')` to check whether the column exists, then run `ALTER TABLE ... ADD COLUMN` only if it doesn't. See `db.rs:run_migrations` for the `duration_minutes` example — follow the same pattern for any future column additions.

**sqlx SQLite does not create the database file by default.**
Connecting via a plain URL string (e.g. `sqlite:///data/tasks.db`) fails with
`SQLITE_CANTOPEN (code 14)` if the file does not exist.
The fix is `SqliteConnectOptions::from_str(url)?.create_if_missing(true)` — see
`db.rs:init_pool`. Using `.connect(url)` directly will regress this.

**nginx resolves upstream hostnames at startup, not per-request.**
If the `backend` container is down or still starting when nginx loads its config,
nginx exits with `host not found in upstream "backend"`.
The fix is `resolver 127.0.0.11 valid=10s` (Docker's internal DNS) combined with
`set $backend "http://backend:3000"` and `proxy_pass $backend` — see `nginx.conf`.
Using a literal string in `proxy_pass` (e.g. `proxy_pass http://backend:3000`)
will regress this; the variable form is required for lazy resolution.

**Rust toolchain version must be ≥ 1.86 in the backend Docker builder.**
Transitive dependencies (`icu_*` v2.2.0, `base64ct` v1.8.3) require edition 2024 /
rustc 1.86. The `backend/Dockerfile` pins `rust:1.86-slim`; do not downgrade it.
The minimum version is driven by `Cargo.lock`, not `Cargo.toml`.

### Key constraints

- **No update endpoint** — tasks and members are create-or-delete only. There is no PATCH.
- **Alarm is one-shot** — once `alarm_fired=1` is set, that task never fires again even after a server restart. To re-arm, delete and recreate the task.
- **Alarm popup carries `memberColor`** — `App.jsx` resolves the member's `color` field at SSE event time and stores it in the alarm object so `AlarmBanner` can render the colored header without an extra lookup. The SSE payload itself only contains the raw `task` object; member metadata is joined client-side from the `members` state array.
- **SSE is invalidation-only** — `tasks_changed` tells the browser to refetch; it does not carry the diff. All data reads go through the REST endpoints.
- **CORS is wide open** (`Any`) — appropriate for local dev, must be tightened before any deployment.
- **No auth** — single-household, trusted-network design assumption.
