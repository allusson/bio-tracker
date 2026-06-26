# data/real_data/

Handles connectivity to Databricks and conversion of raw scan telemetry into the standard pipeline schema. The two files here serve as the real-data counterpart to `data/synthetic_data/generator.py`: together they produce the same long-format `gateway_id | timestamp | device_id | rssi` DataFrame that the rest of the pipeline consumes.

---

## Files

### `databricks_pull.py` — Databricks SQL query (stub)

**Status: stub — not yet implemented.**

Will connect to Databricks using credentials from the environment, run a SQL query against `etl_device_telemetry_bronze.gateway_scan_telemetry`, and return a raw DataFrame. The query will filter to the four columns the pipeline needs and optionally accept a date range.

Planned signature:

```python
def pull(start_date: str | None = None, end_date: str | None = None) -> pd.DataFrame:
    ...
```

Planned output schema (raw Databricks column names, before preprocessing):

| Column | Notes |
|---|---|
| `gateway_id` | BioHub identifier |
| `reported_scan_timestamp` | Time the hub *reported* the scan — use this, not `timestamp` |
| `scanned_device_id` | BioButton device identifier |
| `rssi` | Signal strength in dBm |

> **Critical:** Always include `WHERE gateway_id != 'bio_id_test_scan_results'` in any query. That gateway is a test fixture with artificial RSSI readings (-20 dBm) that will corrupt any analysis.

> **Connector:** Uses `databricks-sql-connector` (`from databricks import sql`), **not** `databricks-sdk`. `requirements.txt` currently lists `databricks-sdk` — install the correct package: `pip install databricks-sql-connector`.

### `preprocessor.py` — Raw data cleaner

**Status: implemented.**

Accepts the raw DataFrame from `databricks_pull.pull()` and returns a clean DataFrame using the internal pipeline column names, ready to be passed to `pipeline/wrangler.py`.

---

## Key Functions

### `preprocess(df: pd.DataFrame) -> pd.DataFrame`

```python
def preprocess(df: pd.DataFrame) -> pd.DataFrame
```

**Input:** Raw DataFrame with at minimum:

| Column | Notes |
|---|---|
| `gateway_id` | BioHub identifier |
| `reported_scan_timestamp` | Correct scan time column |
| `scanned_device_id` | BioButton device identifier |
| `rssi` | Raw signal strength |

**What it does:**

1. Selects only the four relevant columns; drops everything else to save memory.
2. Renames `reported_scan_timestamp → timestamp` and `scanned_device_id → device_id` so the rest of the pipeline uses consistent names.
3. Parses `timestamp` to UTC-aware `pd.Timestamp` via `pd.to_datetime(..., utc=True)`. Without `utc=True`, tz-naive strings from Databricks would break any comparison against tz-aware timestamps later in the pipeline.
4. Drops rows where `gateway_id`, `device_id`, or `rssi` is null.
5. Drops rows with physically implausible RSSI: anything above 0 dBm (physically impossible for BLE) or below -100 dBm (below every known BLE chipset's sensitivity floor).
6. Sorts by `(device_id, timestamp)` so each device's scan history is in chronological order. This ordering is required for `aggfunc="last"` in `wrangler.py` to correctly represent the most-recent reading in a window.
7. Prints a summary: row count, unique devices, unique gateways, and date range.

**Output schema:**

| Column | Type | Notes |
|---|---|---|
| `gateway_id` | str | BioHub identifier |
| `timestamp` | `pd.Timestamp` (UTC) | Parsed scan time |
| `device_id` | str | BioButton identifier |
| `rssi` | float | dBm; guaranteed in `[-100, 0]` |

---

## Data Flow

```
Databricks
  etl_device_telemetry_bronze.gateway_scan_telemetry
          │
          │  (raw: gateway_id, reported_scan_timestamp,
          │         scanned_device_id, rssi)
          ▼
  databricks_pull.pull()    ← stub
          │
          ▼
  preprocessor.preprocess()
          │
          │  (clean: gateway_id, timestamp, device_id, rssi)
          ▼
  pipeline/wrangler.py
```

---

## Dependencies

| Library | Purpose |
|---|---|
| `pandas` | DataFrame manipulation and timestamp parsing |
| `databricks-sql-connector` | Databricks SQL connection (`from databricks import sql`) |

---

## Usage

```python
# Once databricks_pull.py is implemented:
from real_data import databricks_pull, preprocessor

raw_df   = databricks_pull.pull(start_date="2025-03-04", end_date="2025-03-05")
clean_df = preprocessor.preprocess(raw_df)
# clean_df is ready to pass to pipeline/wrangler.py
```

---

## Critical Gotchas

- **Column name:** The correct timestamp column in `gateway_scan_telemetry` is `reported_scan_timestamp`. The `timestamp` column in the same table is a pipeline ingestion artifact (time the row landed in the lakehouse), not the time the hub actually scanned the device. Using `timestamp` instead of `reported_scan_timestamp` will produce incorrect time windows.
- **Test gateway:** `bio_id_test_scan_results` must always be excluded. Its readings are synthetic fixtures (RSSI ≈ -20 dBm) and will distort every downstream metric.
- **Sort before wrangling:** `preprocess()` sorts by `(device_id, timestamp)`. If anything reshuffles the rows between preprocessing and wrangling, `aggfunc="last"` in `wrangler.py` will not behave as documented — it picks last by row position, not by timestamp value.
