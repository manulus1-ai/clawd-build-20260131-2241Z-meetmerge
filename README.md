# MeetMerge

Mobile-first group scheduling: host proposes 3–7 candidate times, guests tap **Yes / Maybe / No**, and the host locks a winner.

- Hook: **“Stop the ‘when are you free?’ spiral.”**
- Zero-account guest voting.
- Works as **frontend-only demo** on GitHub Pages.
- Optional **C#/.NET backend** (SQLite) for true multi-user persistence.

## Live demo

After GitHub Pages deploy, the app is here:

- https://<YOUR_GH_USER>.github.io/<REPO_NAME>/

## Features

### V1 (MVP)
- Create poll with **3–7** time slots
- Share link
- Guests vote yes/maybe/no
- Host results view + **Lock winner**

### V2 (Delight)
- Templates (dinner/workout/boardgames)
- Invite-card aesthetic, big tap targets

### V3 (Utility)
- Timezone clarity (local time + zone label)
- **ICS download** + Google Calendar deep link after lock

## Frontend-only demo mode (GitHub Pages)

GitHub Pages hosts **only the Angular frontend**.

- Demo mode is enabled when `frontend/meetmerge/src/assets/config.json` has an empty `apiBaseUrl`.
- In demo mode, the poll definition is embedded in the URL, and votes are stored per-device (great for UX testing; not true multi-user aggregation).

## Running locally

### Frontend

```bash
cd frontend/meetmerge
npm install
npm start
```

### Backend (Docker)

You don’t need `dotnet` installed; Docker builds and runs the API.

```bash
docker compose up --build api
```

API: http://localhost:8080/api/health

### Connect frontend to backend

Edit `frontend/meetmerge/src/assets/config.json`:

```json
{ "apiBaseUrl": "http://localhost:8080" }
```

Then restart the frontend.

### Full local stack (API + static web)

Build the frontend, then run compose:

```bash
cd frontend/meetmerge
npm run build
cd ../..
docker compose up --build
```

- API: http://localhost:8080
- Static web: http://localhost:8081

## Backend deployment notes

- The API is a .NET 8 minimal API using SQLite at `DB_PATH` (default `/data/meetmerge.db`).
- Configure CORS via `CORS_ORIGINS` (comma-separated). For production you should set this to your frontend origin.
- Consider replacing the toy in-memory rate limiter with a real reverse proxy + proper rate limiting.

## Repo structure

- `frontend/meetmerge` — Angular app
- `backend/MeetMerge.Api` — .NET 8 API (Docker build)
- `.github/workflows/pages.yml` — GitHub Pages deploy for frontend
