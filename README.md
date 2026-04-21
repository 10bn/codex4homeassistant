# HA Codex Add-on Repository

`HA Codex` is a Home Assistant add-on that runs behind **Ingress**, appears in the HA sidebar, and provides a small web UI to inspect runtime data safely.

## What this first version does

- Serves a lightweight Ingress UI from the add-on container.
- Reads Home Assistant Core config via Supervisor proxy.
- Reads Home Assistant entity states via Supervisor proxy.
- Lists top-level files/folders from `/config`.
- Includes one clearly isolated **optional** write-test endpoint (`/api/test/write`) that is disabled by default.

The design is intentionally simple and auditable for a first production-structured release.

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

1. Ensure your GitHub repo is **public**.
2. In Home Assistant open: **Settings → Add-ons → Add-on Store → ⋮ → Repositories**.
3. Add:
   - `https://github.com/10bn/codex4homeassistant`
4. Refresh Add-on Store.

### If you see this clone error

```text
fatal: could not read Username for 'https://github.com'
```

Then HA cannot access the repository anonymously (usually private repo). Make it public or publish a public mirror for add-on installation.

---

## Install and Start

1. Open add-on **HA Codex**.
2. Click **Install**.
3. (Optional) Enable **Start on boot**.
4. Click **Start**.
5. Open from sidebar panel **HA Codex**.

---

## Configuration Options

In the add-on **Configuration** tab:

- `debug` (`bool`, default `false`)
  - Enables extra debug mode hooks for future expansion.
- `max_entities` (`int`, 10-2000, default `250`)
  - Caps `/api/entities` response size for safer UI payloads.
- `allow_test_write` (`bool`, default `false`)
  - Enables the isolated test write endpoint.
- `test_write_filename` (`str`, optional, default `ha_codex_test.txt`)
  - File name created in `/config` by test write endpoint.

---

## API Endpoints (v1)

- `GET /api/ping`
  - Health check endpoint.
- `GET /api/options`
  - Returns current add-on options.
- `GET /api/config`
  - Fetches data from `http://supervisor/core/api/config` using:
    - `Authorization: Bearer ${SUPERVISOR_TOKEN}`
- `GET /api/entities`
  - Fetches states from `http://supervisor/core/api/states`.
  - Returns a slimmed response (`entity_id`, `state`, `last_changed`, `friendly_name`).
  - Capped at `max_entities`.
- `GET /api/files`
  - Lists top-level entries from `/config` safely (name + type only).
- `POST /api/test/write`
  - Optional isolated write test (requires `allow_test_write: true`).

All Supervisor calls use `Authorization: Bearer ${SUPERVISOR_TOKEN}`.

---

## Notes on Safety / Extensibility

- `/config` is mounted read/write in add-on config, but UI/API behavior in v1 is read-focused.
- The only write path (`/api/test/write`) is explicitly opt-in via `allow_test_write` option.
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
  - `maintainer` (optional if you want your preferred contact address)

Repository URLs are now set to `https://github.com/10bn/codex4homeassistant`.
