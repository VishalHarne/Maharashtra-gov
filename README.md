# ShalaSetu POC

A local proof of concept for school visit reporting, manager review, and follow-up task tracking. All included school and user records are synthetic demo data; UDISE-like values are prefixed with `DEMO-` and must not be treated as official assignments or verified public records.

## Start locally

Run these commands in separate terminals from the project root:

```powershell
npm install
npm run dev:api
npm run dev:web
```

Open `http://localhost:5173`. The API listens at `http://localhost:4000`. On its first start it creates `backend/data/store.json` with synthetic school and demo-user records. Visits, findings, notifications, actions, sessions, and audit events are written there as JSON.

For a physical Expo device, set `EXPO_PUBLIC_API_URL` to the API host reachable on your local network, for example `http://192.168.1.20:4000/api/v1`, then start the app with `npm run start:mobile`. To change the web API URL, set `VITE_API_URL` before running the web workspace. The API allows the web origin `http://localhost:5173` by default; configure `WEB_ORIGIN` if the web client uses a different origin.

## Demo sign-in

All demo accounts use password `Demo@123`:

| Username | Role | Demo access |
| --- | --- | --- |
| `gsa.demo` | Gat Shikshan Adhikari | Haveli block dashboard, visit inbox, report review, task assignment |
| `kp.demo` | Kendra Pramukh | One assigned demo school, visit and finding submission |
| `hm.demo` | Headmaster | School-specific task queue |

These accounts are for local demonstration only. Passwords are stored as salted scrypt hashes in the local JSON store. Do not deploy this demo authentication or JSON storage as a production identity/data system.

## Visit flow

1. Sign in as `kp.demo` and submit a visit with a finding.
2. Sign in as `gsa.demo`; the submitted report appears in the review inbox.
3. The manager can approve the report, raise a concern with a note, and assign a follow-up task to a headmaster assigned to that school.
4. Sign in as `hm.demo` to see the task in the school action queue.

Protected endpoints validate the bearer token and role/scope on the server. Visit submissions are audit logged, and notification/task/review changes are persisted to the local store.

## API outline

- `POST /api/v1/auth/login` and `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/schools` and `GET /api/v1/schools/:id/action-owners`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/visits` and `POST /api/v1/visits`
- `GET /api/v1/notifications`
- `POST /api/v1/notifications/:id/respond`
- `POST /api/v1/notifications/:id/tasks`
- `GET /api/v1/actions`

Timestamps are stored in UTC. This prototype uses local JSON persistence and does not yet implement offline synchronization/conflict resolution, evidence uploads, production identity integration, or a government data feed.
