# Firebase Firestore Schema — AIS Sales

**Project:** `ais-production-e013c`  
**Last updated:** March 2026  
**ETL source:** `xcomp11.DB` (SQLite — Aadinath billing system)  
**ETL script:** `api/firebase_sync.py`

---

## Overview

The Firestore database is read-only from the frontend's perspective — all writes come exclusively from the Python ETL script (`firebase_sync.py`) running server-side via the Admin SDK. Security rules enforce `write: if false` on all sales collections for the client SDK.

The sync pipeline:

```
Windows billing PC (192.168.1.59)
  D:/CraftInv/Backup/XCOMP11_DD_MM_YYYY.DB  (daily closed backup)
    ↓  SFTP (binary — avoids CR/LF truncation of Windows SCP)
/home/adityajain/AIS/assets/xcomp11.DB  (Pi)
    ↓  firebase_sync.py  (triggered only when a new daily backup appears)
Firebase Firestore (ais-production-e013c)
    ↓  Firebase client SDK (read-only)
Next.js dashboard
```

**Note:** The live `D:/CraftInv/xcomp11.DB` is locked by the billing software and cannot be read directly. The sync always uses the latest closed daily backup file. Change detection is filename-based (`LAST_SYNCED_FILE = /home/adityajain/AIS/assets/.last_synced_backup`) — Firebase sync only runs when a new backup filename appears, not on every 5-minute poll.

**Collections written by the ETL:**

| Collection | Documents | Source table(s) |
|---|---|---|
| `sales` | 1,435 (1,420 active + 10 cancelled + 5 other) | `gstsale` + `gstsaledet` + `acmast` |
| `customers` | 667 | `acmast` |
| `items` | 17 | `item` + `itemgrp` (only items that appear in actual sales) |
| `_meta` | 1 (`summary`) | `gstsale` aggregate |

**Collection defined in rules but not yet populated:**

| Collection | Notes |
|---|---|
| `purchases_data` | Rule exists, ETL sync not implemented |

---

## Collection: `sales`

**Document ID:** string form of `vno` (e.g. `"1423"`)  
**Coverage:** All `book = 'L1'` invoices, no date/count limit. April 2025 – present.

### Fields

| Field | Type | Description |
|---|---|---|
| `vno` | number | Internal voucher number. Same as document ID. |
| `vdate` | string | Invoice date in `YYYY-MM-DD` format. |
| `billno` | number | Sequential bill number within the book series. |
| `invno` | string | Formatted invoice number e.g. `"TI/1571"`. |
| `amount` | number | Taxable amount (excluding GST). |
| `billamt` | number | Total invoice amount (taxable + GST + rounding). |
| `gst` | number | Combined GST = `cgstamt + sgstamt + igstamt`. |
| `cess` | number | Cess amount (0 for most bills). |
| `invcancelflag` | string | `""` = active bill. `"Y"` = cancelled. |
| `customer_accode` | number | FK → `customers/{accode}`. |
| `customer_name` | string | Party/company name. |
| `customer_state` | string | GST state code e.g. `"24"` (Gujarat). |
| `customer_address` | string | `addrs1 + addrs2 + addrs3` joined with spaces. |
| `billqty` | number | Total weight across all line items (MT, 3 decimal places). |
| `basic_rate` | number | `total taxableamt / total weight` (₹/MT, 2 decimal places). 0 if no line items. |
| `items` | array | Line-item detail. Empty array `[]` if no `gstsaledet` rows exist. |

### `items[]` — embedded line items

Each element of the `items` array:

| Field | Type | Description |
|---|---|---|
| `srno` | number | Line number within the bill (1-indexed). |
| `itemcode` | number | FK → `items/{itemcode}`. |
| `itemname` | string | Product name e.g. `"M.S ANGLE"`. |
| `unit` | string | Unit of measure e.g. `"MTS"`. |
| `weight` | number | Weight in metric tonnes (3 decimal places). |
| `rate` | number | Rate per MT in ₹ (2 decimal places). |
| `taxableamt` | number | Taxable amount for this line (2 decimal places). |
| `gstper` | number | GST percentage e.g. `18`. |

### Example document

```json
{
  "vno": 1423,
  "vdate": "2026-02-28",
  "billno": 1571,
  "invno": "TI/1571",
  "amount": 65550.38,
  "billamt": 77349,
  "gst": 11799.06,
  "cess": 0,
  "invcancelflag": "",
  "customer_accode": 54,
  "customer_name": "SOME STEEL TRADERS",
  "customer_state": "24",
  "customer_address": "Plot No. 12, GIDC, Surat",
  "billqty": 1.325,
  "basic_rate": 49474.62,
  "items": [
    {
      "srno": 1,
      "itemcode": 3,
      "itemname": "M.S ANGLE",
      "unit": "MTS",
      "weight": 1.325,
      "rate": 49474.62,
      "taxableamt": 65554.38,
      "gstper": 18
    }
  ]
}
```

---

## Collection: `customers`

**Document ID:** string form of `accode` (e.g. `"54"`)  
**Coverage:** All 667 accounts from `acmast` (customers and suppliers both).

### Fields

| Field | Type | Description |
|---|---|---|
| `accode` | number | Account code. Same as document ID. |
| `acname` | string | Company or party name. |
| `addrs1` | string | Address line 1. |
| `addrs2` | string | Address line 2. |
| `addrs3` | string | Address line 3 (city/district). |
| `gststate` | string | GST state code. |
| `mobile1` | string | Primary mobile number. |
| `email` | string | Email address. May be empty. |
| `gstin` | string | GST Identification Number. May be empty. |

### Example document

```json
{
  "accode": 54,
  "acname": "SOME STEEL TRADERS",
  "addrs1": "Plot No. 12",
  "addrs2": "GIDC Industrial Estate",
  "addrs3": "Surat",
  "gststate": "24",
  "mobile1": "9876543210",
  "email": "contact@somesteeltraders.com",
  "gstin": "24ABCDE1234F1Z5"
}
```

---

## Collection: `items`

**Document ID:** string form of `itemcode` (e.g. `"3"`)  
**Coverage:** 17 distinct items that have appeared in at least one `book = 'L1'` sale. The full `item` table has 42 entries but most have never been sold.

### Fields

| Field | Type | Description |
|---|---|---|
| `itemcode` | number | Item code. Same as document ID. |
| `itemname` | string | Product name. |
| `unit` | string | Unit of measure e.g. `"MTS"`. |
| `hsncode` | string | HSN code for GST filing. |
| `gstrate` | number | GST rate percentage e.g. `18`. |
| `group_name` | string | Item group from `itemgrp` table. |

### Items present in Firestore

| itemcode | itemname | group_name |
|---|---|---|
| 1 | M S ROUND BAR/SQUARE BAR (T) | TRADING |
| 3 | M.S ANGLE | FINISHED GOODS |
| 4 | WASTE & SCRAP (T) | RAW MATERIAL |
| 6 | OLD & USED PLATES. | RAW MATERIAL |
| 8 | M.S FLAT (T) | TRADING |
| 9 | M.S BRIGHT BAR (T) | TRADING |
| 10 | WASTE AND SCRAP | FINISHED GOODS |
| 11 | MILL SCALE | RAW MATERIAL |
| 16 | M S ROUND & SQUARE BAR | FINISHED GOODS |
| 24 | M.S ANGLE (T) | TRADING |
| 25 | M S ROUND BAR | FINISHED GOODS |
| 32 | CI CASTING SCRAP | RAW MATERIAL |
| 34 | M.S. BILLET (MISS ROLL) | FINISHED GOODS |
| 38 | MISROLL SCRAP | RAW MATERIAL |
| 40 | ELECTRIC AC MOTOR | CONSUMABLE |
| 42 | M.S.BILLET | M.S.BILLET |
| 43 | M.S.BRIGHT FLAT (T) | TRADING |

### Example document

```json
{
  "itemcode": 3,
  "itemname": "M.S ANGLE",
  "unit": "MTS",
  "hsncode": "72165000",
  "gstrate": 18,
  "group_name": "FINISHED GOODS"
}
```

---

## Collection: `_meta`

### Document: `summary`

Aggregated totals across all active `book = 'L1'` bills (cancelled bills excluded). Rewritten on every sync run.

| Field | Type | Description |
|---|---|---|
| `total_bills` | number | Count of active (non-cancelled) L1 invoices. |
| `total_taxable` | number | Sum of `amount` (taxable value excl. GST). |
| `total_bill_amount` | number | Sum of `billamt` (total incl. GST). |
| `total_gst` | number | Sum of all GST collected. |
| `last_synced` | string | ISO 8601 datetime of last successful sync e.g. `"2026-03-03T14:25:23.444567"`. |

### Example document

```json
{
  "total_bills": 1420,
  "total_taxable": 452000000.0,
  "total_bill_amount": 533360000.0,
  "total_gst": 81360000.0,
  "last_synced": "2026-03-03T14:25:23.444567"
}
```

---

## Firestore Security Rules Summary

Defined in `firestore.rules`. All sales collections are **read-only** for authenticated users via the client SDK. The Admin SDK (used by `firebase_sync.py`) bypasses these rules entirely.

| Collection | Client Read | Client Write |
|---|---|---|
| `sales` | Any signed-in user | Never |
| `customers` | Any signed-in user | Never |
| `items` | Any signed-in user | Never |
| `purchases_data` | Any signed-in user | Never |
| `_meta` | Any signed-in user | Never |

Authentication is Google OAuth via Firebase Auth. Role-based access (`admin`, `operator`) is used for other collections in the same project (production system, CV system) but not enforced on the sales collections beyond requiring sign-in.

---

## ETL Sync Details

**Script:** `api/firebase_sync.py`  
**Triggered by:** `api/db_sync.py` — polls every 5 minutes, only triggers Firebase sync when a new daily backup filename is detected  
**Credential:** `firebase-service-account.json` (Firebase Admin SDK service account — bypasses Firestore security rules)  
**Batch strategy:** Firestore writes are chunked in batches of 500 (Firestore hard limit per batch)

### Functions

| Function | Writes to | Key SQL |
|---|---|---|
| `sync_customers_data()` | `customers` | `SELECT ... FROM acmast` (all ~668 rows, chunked in batches of 500) |
| `sync_items_data()` | `items` | `SELECT DISTINCT ... FROM gstsaledet JOIN item JOIN gstsale WHERE book='L1'` |
| `sync_sales_data()` | `sales` | Header query + separate line-items query, merged in Python by `vno` |
| `sync_summary()` | `_meta/summary` | `SELECT COUNT(*), SUM(...) FROM gstsale WHERE book='L1' AND invcancelflag != 'Y'` |

### What changed from the original sync (history)

| | Before | After |
|---|---|---|
| DB source | `~/.openclaw/workspace/xcomp11.DB` via Google Drive (broken) | `/home/adityajain/AIS/assets/xcomp11.DB` via SFTP from Windows |
| DB sync trigger | `gdrive_sync.py` (mtime check — always fired) | `db_sync.py` (filename check — only fires on new daily backup) |
| Sales coverage | Latest 500 bills only (`LIMIT 500`) | All bills, no limit (~1,446) |
| Line-item detail | None — only aggregated `billqty` and `basic_rate` | Full `items[]` array embedded in each sales doc |
| Cancelled flag | Not stored | `invcancelflag` field included |
| Invoice number | Not stored | `invno` field included (e.g. `"TI/1571"`) |
| Items synced | 3 hardcoded (itemcodes 3, 11, 14) | All 17 items that appear in actual sales |
| Items fields | `itemcode`, `itemname` only | + `unit`, `hsncode`, `gstrate`, `group_name` |
| Summary filter | All books, all bills | `book='L1'`, active bills only |
| Customers batch | Single batch (broke at >500 rows) | Chunked at 500 |
