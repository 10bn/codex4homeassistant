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

## Konfigurationsoptionen

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
- `GET /api/options`
- `GET /api/config` → `http://supervisor/core/api/config`
- `GET /api/entities` → `http://supervisor/core/api/states` (slimmed + limited)
- `GET /api/files` → lists top-level `/config`
- `POST /api/test/write` → optional isolated write test (requires `allow_test_write: true`)

All Supervisor calls use `Authorization: Bearer ${SUPERVISOR_TOKEN}`.

---

## What to build next

- Add `/api/codex/plan` read-only planning route.
- Add explicit authz + auditing before any real write routes.
- Add endpoint-level integration tests.
- Add websocket/streaming UX improvements.
