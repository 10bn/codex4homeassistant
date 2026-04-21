# HA Codex Add-on Repository

`HA Codex` is a minimal, production-structured Home Assistant add-on that runs behind **Ingress** and appears in the Home Assistant sidebar.

It serves a small web UI and provides read-focused API endpoints that:

- Reach Home Assistant Core through the Supervisor proxy using `SUPERVISOR_TOKEN`.
- Read Home Assistant runtime config/state.
- List top-level files/folders in `/config`.

This first version intentionally avoids destructive write flows to keep behavior auditable.

---

## Repository Structure

```text
.
├─ repository.yaml
└─ ha-codex/
   ├─ config.yaml
   ├─ Dockerfile
   ├─ rootfs/
   │  └─ etc/
   │     └─ services.d/
   │        └─ app/
   │           └─ run
   └─ app/
      ├─ package.json
      ├─ server.js
      └─ web/
         ├─ index.html
         ├─ app.js
         └─ styles.css
```

---

## Add this Repository to Home Assistant

1. Commit and push this repository to GitHub.
2. In Home Assistant, go to **Settings → Add-ons → Add-on Store → ⋮ (top-right) → Repositories**.
3. Add your repository URL, for example:
   `https://github.com/<your-user>/<your-repo>`
4. Refresh the Add-on Store.

---

## Install and Start the Add-on

1. Open the add-on named **HA Codex**.
2. Click **Install**.
3. Enable **Start on boot** (optional).
4. Click **Start**.
5. Open the add-on from the sidebar (Ingress panel title: **HA Codex**).

---

## Current API Endpoints

- `GET /api/ping`
  - Health check endpoint.

- `GET /api/config`
  - Fetches data from `http://supervisor/core/api/config` using:
    - `Authorization: Bearer ${SUPERVISOR_TOKEN}`

- `GET /api/entities`
  - Fetches states from `http://supervisor/core/api/states`.
  - Returns a slimmed response (`entity_id`, `state`, `last_changed`, `friendly_name`).

- `GET /api/files`
  - Lists top-level entries from `/config` safely (name + type only).

---

## Notes on Safety / Extensibility

- `/config` is mounted read/write in add-on config, but UI/API behavior in v1 is read-focused.
- No destructive file mutation flows are implemented yet.
- `server.js` includes TODO markers for a future `/api/codex/*` namespace (e.g. `/api/codex/plan`).

---

## What to Build Next

- Add a dedicated `/api/codex/plan` endpoint (read-only planning first).
- Add role-guarded write endpoints (explicitly opt-in).
- Add schema validation and request logging middleware.
- Add integration tests for ingress/API behavior.
- Add optional long-poll or websocket stream handling for richer UI updates.

---

## Manual Placeholders to Replace

- `repository.yaml`
  - `url`
  - `maintainer`
- `ha-codex/config.yaml`
  - `url`

Replace these with your real GitHub repository and maintainer details before publishing.
