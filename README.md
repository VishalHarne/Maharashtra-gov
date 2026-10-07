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

For a physical Expo device, set `EXPO_PUBLIC_API_URL` to the API host reachable on your local network, for example `http://192.168.1.20:4000/api/v1`, then start the app with `npm run start:mobile`. In Vite development, the web client automatically uses the same hostname as the page for its API URL (so a page opened at `http://192.168.1.4:5173` calls `http://192.168.1.4:4000/api/v1`). Set `VITE_API_URL` only to override that default. The API allows local private-network Vite origins on ports `5173`-`5179` in development; configure `WEB_ORIGIN` for production origins.

## GitLab CI and Pages

The `.gitlab-ci.yml` pipeline checks the API syntax, builds the web client, type-checks mobile, and publishes the web build through GitLab Pages on the default branch. Vite's base path is derived from GitLab's `CI_PAGES_URL`, so project Pages URLs load their assets from the correct subpath.

Pages hosts static files only; it cannot run this Express API. The API can keep running on this Windows machine for users on the same network. Its listener binds to `0.0.0.0:4000`; this machine's current Wi-Fi IPv4 is `192.168.1.4` (check `ipconfig` if it changes). Start it from the project root in a terminal that stays open:

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '4000'
$env:WEB_ORIGIN = 'http://192.168.1.4:5173'
npm run start:api
```

Allow inbound TCP port `4000` on the Windows firewall's **Private** network profile only, and reserve this machine's LAN IP in the router if clients depend on a stable address. Other devices on the same Wi-Fi can use `http://192.168.1.4:4000/api/v1`. The machine must stay powered on and connected; its local JSON store is only as durable as this machine's disk and backups.

For a same-LAN web client served over HTTP, browse to `http://192.168.1.4:5173`; Vite development infers `http://192.168.1.4:4000/api/v1` from that page URL. If you set a `VITE_API_URL` override, use that LAN API URL and restart Vite.

**Important:** GitLab Pages uses HTTPS, so browsers block its page from calling a plain-HTTP `http://192.168.1.4:4000` API as mixed content. Also, `192.168.1.4` is a private address that is not reachable from outside this LAN. To use the Pages website, expose this machine's API through an HTTPS endpoint (for example, a secured tunnel or HTTPS reverse proxy with a domain); then set GitLab CI/CD variable `VITE_API_URL` to that HTTPS API URL including `/api/v1`, and set the API's `WEB_ORIGIN` to the exact Pages origin shown in **Deploy > Pages**. Do not publish this demo API directly to the internet without replacing demo authentication and securing its data.

Push to the default branch to run the pipeline and publish the static web app. If `VITE_API_URL` is unset, Pages still publishes, but sign-in displays a configuration error rather than trying to call `localhost` on each visitor's device.

The included JSON-store API, demo accounts, and demo school assignments are POC-only and should not be exposed as a production governance system.

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
