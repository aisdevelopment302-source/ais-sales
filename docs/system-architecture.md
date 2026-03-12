# System Architecture — AIS Sales Dashboard

**Project:** `ais-production-e013c` (Firebase)  
**Last updated:** March 2026

---

## Overview

The AIS Sales Dashboard displays billing data from the Aadinath billing software (`xcomp11.DB`, a SQLite database on a Windows PC) in a Next.js web application. Data flows one-way: Windows PC → Raspberry Pi → Firebase Firestore → Next.js dashboard.

The Windows billing PC is not always on. When it is unreachable, the sync loop silently skips and retries on the next 5-minute poll — the Pi and dashboard continue working with the last successfully synced data.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Windows PC  (192.168.1.59, user HP)                                │
│  CraftInv billing software                    ← not always on       │
│  D:/CraftInv/xcomp11.DB  (live — readable via SFTP while app runs) │
└───────────────────┬─────────────────────────────────────────────────┘
                    │  SFTP (binary transfer, not SCP)
                    │  SSH key auth, no password
                    │  8s connect timeout — silently skips if PC is off
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Raspberry Pi  (raspberrypi / local network)   ← always on          │
│  /home/adityajain/AIS/assets/xcomp11.DB   (synced copy)            │
│  /home/adityajain/AIS/ais-sales/          (this repo)              │
│                                                                     │
│  ais-sales-backend.service  (systemd, Restart=always)              │
│    ├── api/db_sync.py   (5-min poll, SFTP pull, triggers Firebase) │
│    └── api/main.py      (FastAPI, port 8000, SQLite → JSON)        │
└───────┬──────────────────────────────────────────────────────────┬──┘
        │  Firebase Admin SDK (write)                              │  HTTP
        ▼                                                          ▼
┌──────────────────────────┐                         ┌────────────────────┐
│  Firebase Firestore      │                         │  Vercel (optional) │
│  ais-production-e013c    │◄────────────────────────│  Next.js frontend  │
│  sales / customers /     │  Firebase client SDK    │  (deployed to      │
│  items / _meta           │  (read-only, auth req.) │  Firebase Hosting) │
└──────────────────────────┘                         └────────────────────┘
```

---

## Components

### 1. Windows PC — Data Source

| | |
|---|---|
| **Host** | `192.168.1.59`, user `HP` |
| **Billing software** | CraftInv (Aadinath) |
| **Live DB** | `D:/CraftInv/xcomp11.DB` — readable via SFTP even while CraftInv has it open |
| **Availability** | Not always on — Pi handles this gracefully |
| **SSH access** | Pi → Windows SSH key in `C:\ProgramData\ssh\administrators_authorized_keys` |

**Why SFTP, not SCP?** Windows OpenSSH's SCP implementation runs in text mode and stops at `\x1A` (Ctrl+Z), treating it as an EOF marker. This silently truncates SQLite binary files to ~200KB. SFTP transfers in binary mode and avoids this entirely.

**Why the live DB, not backups?** Earlier sessions used daily backup files (`D:/CraftInv/Backup/XCOMP11_DD_MM_YYYY.DB`) because the live file was assumed to be locked. Testing confirmed SFTP can read `xcomp11.DB` fine while CraftInv is running. Switching to the live file gives ~5-minute data freshness instead of up to 24 hours.

---

### 2. Raspberry Pi — Backend Server

All backend processes run as a single systemd service.

#### `ais-sales-backend.service`

```
/etc/systemd/system/ais-sales-backend.service
```

- **User:** `adityajain`
- **ExecStart:** `/bin/bash start-backend.sh`
- **Restart:** `always` (10s delay)
- **Logs:** `journalctl -u ais-sales-backend.service`

Starts two processes in parallel:
1. `api/db_sync.py` — DB sync loop
2. `venv/bin/uvicorn main:app --app-dir api --host 0.0.0.0 --port 8000` — FastAPI

#### `start-backend.sh`

Activates the venv, launches both processes, traps SIGTERM/SIGINT to cleanly stop both on service restart.

---

### 3. `api/db_sync.py` — DB Sync Loop

Polls every 5 minutes. On each tick:

1. Attempt SFTP of `/D:/CraftInv/xcomp11.DB` from the Windows PC (8s connect timeout).
   - **PC is off / unreachable** → logs `Billing PC unreachable or transfer failed (PC may be off)`, skips, sleeps 5 min.
2. Download to `/home/adityajain/AIS/assets/xcomp11.tmp`.
3. Validate: open with `sqlite3`, run `PRAGMA integrity_check(1)`. Discard if invalid.
4. Compare downloaded file size against size recorded in `.last_synced_size`.
   - **Same size → no new bills.** Delete temp file, skip Firebase sync.
   - **Different size → bills were added/changed.** Proceed.
5. Atomic replace: `xcomp11.tmp → xcomp11.DB`.
6. Write new size to `.last_synced_size`.
7. Subprocess-invoke `firebase_sync.py` (120s timeout).

**State file:** `/home/adityajain/AIS/assets/.last_synced_size`  
Contains the byte size of the last successfully synced DB (e.g. `1941504`). Persists across service restarts. Firebase sync only runs when this changes.

---

### 4. `api/firebase_sync.py` — Firestore ETL

Invoked as a subprocess by `db_sync.py` only when the DB file size changed. Runs a full sync of all four collections each time.

| Function | Collection | Key detail |
|---|---|---|
| `sync_customers_data()` | `customers` | All rows from `acmast`, batched at 500 |
| `sync_items_data()` | `items` | Only items present in `book='L1'` sales — 17 items |
| `sync_sales_data()` | `sales` | All `book='L1'` bills, no limit; `items[]` array embedded |
| `sync_summary()` | `_meta/summary` | Aggregated totals, active bills only |

**Credential:** `firebase-service-account.json` (relative `../` from `api/`)  
**SDK:** Firebase Admin SDK — bypasses Firestore security rules  
**DB path:** Resolves to `/home/adityajain/AIS/assets/xcomp11.DB` via `../../assets/xcomp11.DB` relative to `api/`

---

### 5. `api/main.py` — FastAPI Backend

Runs on port 8000. Serves the Next.js frontend (and optionally Vercel) with live SQLite data.

**Working directory:** Must be `api/` — uvicorn uses `--app-dir api` so `from routers import ...` resolves correctly.

#### Endpoints

| Router | Prefix | Key endpoints |
|---|---|---|
| `sales.py` | `/api/sales` | `GET /monthly`, `/bills`, `/bill/{vno}`, `/cancelled` |
| `customers.py` | `/api/customers` | `GET /customers`, `/customers/{id}` |
| `items.py` | `/api/items` | `GET /items`, `/items/groups`, `/items/monthly` |
| `purchases.py` | `/api/purchases` | `GET /purchases` |
| `summary.py` | `/api/summary` | `GET /summary` |
| `geography.py` | `/api/geography` | `GET /states`, `/cities/{state}`, `/summary` |

CORS is open (`allow_origins=["*"]`) since the API is only accessible on the local network.

**`api/database.py`** provides `query()` / `query_one()` helpers. `DB_PATH` resolves to `/home/adityajain/AIS/assets/xcomp11.DB`.

---

### 6. Firebase Firestore — Read-Only Data Store

**Project:** `ais-production-e013c`

Collections populated by the sales ETL:

| Collection | Docs | Populated by |
|---|---|---|
| `sales` | ~1,451 | `firebase_sync.py` |
| `customers` | ~668 | `firebase_sync.py` |
| `items` | 17 | `firebase_sync.py` |
| `_meta` | 1 (`summary`) | `firebase_sync.py` |
| `purchases_data` | 0 | Not yet implemented |

**Security rules** (`firestore.rules`): All sales collections are `read: if isSignedIn()`, `write: if false`. The Admin SDK bypasses these rules. See `docs/firebase-schema.md` for the full schema.

---

### 7. Next.js Frontend

**Framework:** Next.js 14 (App Router), TypeScript, deployed to Firebase Hosting.  
**Data sources:** Firebase Firestore (client SDK, read-only) + FastAPI backend (HTTP, port 8000).

| Route | Page |
|---|---|
| `/` | Dashboard home |
| `/sales` | Sales list, monthly breakdown |
| `/customers` | Customer directory |
| `/items` | Item/product catalog |
| `/purchases` | Purchases (stub) |
| `/analysis` | Analysis views |
| `/geography` | State/city breakdown |

---

## File Map

```
/home/adityajain/AIS/ais-sales/
│
├── start-backend.sh                  ← Launches db_sync.py + uvicorn in parallel
├── firebase-service-account.json     ← Firebase Admin SDK key (active)
├── firestore.rules                   ← Security rules (sales: read=signedIn, write=false)
├── firebase.json                     ← Firebase Hosting config (out/ dir, SPA rewrite)
├── .env.local                        ← Next.js client SDK env vars (NEXT_PUBLIC_FIREBASE_*)
├── vercel.json                       ← Vercel deployment config (optional)
│
├── api/
│   ├── db_sync.py                    ← 5-min poll: SFTP live DB from Windows, triggers Firebase
│   ├── firebase_sync.py              ← Firestore ETL: customers, items, sales, summary
│   ├── main.py                       ← FastAPI app, includes all routers
│   ├── database.py                   ← SQLite helper (DB_PATH → assets/xcomp11.DB)
│   ├── firebase_config.py            ← Legacy (not used by sync pipeline)
│   ├── requirements.txt              ← Python deps: fastapi, uvicorn, firebase_admin
│   └── routers/
│       ├── sales.py                  ← /api/sales/*
│       ├── customers.py              ← /api/customers/*
│       ├── items.py                  ← /api/items/*
│       ├── purchases.py              ← /api/purchases
│       ├── summary.py                ← /api/summary
│       └── geography.py              ← /api/geography/*
│
├── app/                              ← Next.js App Router pages
│   ├── page.tsx                      ← Dashboard home
│   ├── layout.tsx                    ← Root layout + auth wrapper
│   ├── login/                        ← Google OAuth login page
│   ├── sales/, customers/, items/,
│   │   purchases/, analysis/,
│   │   geography/                    ← Route pages
│
├── components/                       ← Shared React components
├── lib/                              ← Shared utilities, Firebase client init
├── docs/
│   ├── firebase-schema.md            ← Firestore collection schemas (this doc's companion)
│   └── system-architecture.md       ← This file
│
└── venv/                             ← Python 3.x venv (Linuxbrew)
                                         fastapi, uvicorn, firebase_admin,
                                         google-cloud-firestore

/etc/systemd/system/
└── ais-sales-backend.service         ← systemd unit (Restart=always, user=adityajain)

/home/adityajain/AIS/assets/
├── xcomp11.DB                        ← Live synced DB (replaced atomically each sync)
├── xcomp11.tmp                       ← Temp file during SFTP download (transient)
└── .last_synced_size                 ← State file: byte size of last synced DB
                                         e.g. "1941504"
```

---

## Operational Notes

### Checking service health

```bash
sudo systemctl status ais-sales-backend.service
sudo journalctl -u ais-sales-backend.service -f
```

### Forcing a re-sync to Firebase

Delete the state file and restart the service:

```bash
rm /home/adityajain/AIS/assets/.last_synced_size
sudo systemctl restart ais-sales-backend.service
```

This causes `db_sync.py` to treat the next successful download as "changed" and trigger a full Firebase sync.

### Checking what was last synced

```bash
cat /home/adityajain/AIS/assets/.last_synced_size
```

### Manually running Firebase sync

```bash
cd /home/adityajain/AIS/ais-sales
venv/bin/python api/firebase_sync.py
```

### SSH to Windows PC

```bash
ssh HP@192.168.1.59
```
