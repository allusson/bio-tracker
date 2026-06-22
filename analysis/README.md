# analysis/

Jupyter notebooks for exploratory data analysis and pipeline validation. These notebooks connect directly to Databricks to query real deployment data and produce plots saved to `outputs/`.

> **Before committing notebooks:** clear all cell outputs first — outputs may contain real device or patient identifiers. Run `jupyter nbconvert --clear-output --inplace analysis/*.ipynb` or use the "Clear All Outputs" menu option.

---

## Credential Setup (required for all notebooks)

Each notebook loads Databricks credentials from a `.env` file at the repo root. The **first code cell of every notebook** must be:

```python
from dotenv import load_dotenv
load_dotenv("../.env")   # must run before any os.getenv() call
```

Running cells out of order — or running the connection cell before the dotenv cell — will produce a connection with `None` credentials and a confusing authentication error.

`.env` format (plain `KEY=VALUE`, no quotes, no spaces around `=`):

```
DATABRICKS_SERVER_HOSTNAME=dbc-116b948a-d644.cloud.databricks.com
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/d89ac2793b1f6d5c
DATABRICKS_TOKEN=your_token_here
```

The connector is `databricks-sql-connector` (`from databricks import sql`), not `databricks-sdk`.

---

## Notebooks

### `01_data_overview.ipynb` — Real data survey

**Status: implemented.**

Connects to `etl_device_telemetry_bronze.gateway_scan_telemetry` and produces a complete characterisation of the dataset.

**Section 1 — Connection setup**
Loads dotenv, connects, defines a `run_query(sql) -> pd.DataFrame` helper that wraps cursor execution and `.asDict()` row conversion.

**Section 2 — Gateway overview**
Queries per-gateway summary stats: total readings, unique devices, mean RSSI, earliest and latest timestamps. As of the last run: 19,885 unique gateways, 11.4 million total readings. The top two gateways account for ~2.4 million readings between them. Produces `outputs/01_gateway_reading_counts.png`.

**Section 3 — RSSI distribution**
Fetches all filtered RSSI values (`-100 ≤ rssi ≤ 0`, test gateway excluded). As of the last run: mean −69.3 dBm, median −70.0 dBm, σ = 15.0 dB. Overlays a fitted normal distribution curve. Produces `outputs/01_rssi_distribution.png`.

**Section 4 — Temporal pattern**
Pulls 5,000 recent readings from the most active gateway and plots readings per hour to visualise the ~10-minute reporting cadence. Also plots per-gateway reporting offsets (seconds past the nearest 10-minute boundary) to reveal that each hub has a **fixed, per-device clock offset baked in at boot time**. This offset is the empirical motivation for the 20-minute bucketing window. Produces `outputs/01_temporal_pattern.png` and `outputs/01_gateway_clock_offsets.png`.

**Section 5 — Multi-hub visibility**
Counts how many distinct gateways see each `(device, timestamp)` pair. As of the last run: 99.5% of observations are single-hub; 0.5% have 2+ hubs simultaneously. The pipeline depends on these multi-hub windows for localization — they are rare in the raw data but become more frequent after bucketing (see notebook 02). Produces `outputs/01_multi_hub_visibility.png`.

**Key queries:**
- Always filters `WHERE gateway_id != 'bio_id_test_scan_results'`.
- Always filters `WHERE rssi <= 0 AND rssi >= -100`.
- Uses `reported_scan_timestamp`, not `timestamp`.

---

### `02_multi_hub_visibility.ipynb` — Bucketing decision and wrangler validation

**Status: implemented. Requires `floor_timestamp()` from `utils/helpers.py`.**

Documents the clock offset finding in depth and validates that the 20-minute bucketing window (vs. 10-minute) is correct.

**Section 1 — Gateway clock offset analysis**
Uses a known sample device (`t42032c01422c1d01380c1401`) seen by 10 gateways over a 4-hour window. Plots each gateway's report times as a horizontal timeline strip — each gateway forms a clean evenly-spaced line at its own fixed offset. Quantifies the within-window timestamp spread: up to ~9 min 25 sec between earliest and latest hub report for what is logically the same scan observation.

**Section 2 — Bucketing comparison: 10 min vs 20 min**
Applies `floor_timestamp()` with both window sizes to the same data and counts distinct gateways captured per window. With 10-minute bucketing, the clock offset causes gateways for the same logical observation to fall into different buckets, fragmenting the RSSI vector. With 20-minute bucketing, all gateways land in the same bucket. Produces `outputs/02_bucketing_comparison.png`.

**Section 3 — Vector completeness with 20-minute window**
Pulls one full day of real data, runs `pipeline.wrangler.wrangle()` on it, and measures hub-count distribution in the resulting RSSI vectors. Produces `outputs/02_vector_completeness.png`.

---

### `03_synthetic_vs_real.ipynb` — Generator calibration (skeleton only)

**Status: skeleton only — all analysis cells are `pass` stubs.**

Planned side-by-side comparison of synthetic generated data vs. real deployment data. Purpose: calibrate `synthetic_data/config.py` so the generator produces data that is a realistic stand-in for real data during pipeline development.

**Planned sections:**
1. Load real data sample from Databricks
2. Load synthetic data via `synthetic_data.generator.generate()`
3. Compare RSSI distributions (target: synthetic mean ≈ -69 dBm, σ ≈ 15 dB)
4. Compare multi-hub visibility rates
5. Compare temporal density and reporting cadence
6. Compare gateway clock offset behaviour (real hubs have fixed offsets; synthetic hubs currently report at identical timestamps)
7. Calibration recommendations for `synthetic_data/config.py`

---

## Saved Outputs

All plots are written to `outputs/` (gitignored). File naming convention: `NN_description.png` where `NN` matches the notebook number.

| File | Notebook | Contents |
|---|---|---|
| `01_gateway_reading_counts.png` | 01 | Bar chart: top 15 gateways by reading count |
| `01_rssi_distribution.png` | 01 | RSSI histogram + normal fit |
| `01_temporal_pattern.png` | 01 | Readings per hour for top gateway |
| `01_gateway_clock_offsets.png` | 01 | Per-gateway reporting offset strip plot |
| `01_multi_hub_visibility.png` | 01 | Hub count distribution (raw data) |
| `02_gateway_timelines.png` | 02 | Timeline strip chart for sample device |
| `02_bucketing_comparison.png` | 02 | 10 min vs 20 min gateway capture counts |
| `02_vector_completeness.png` | 02 | Hub-count distribution after wrangling |

---

## Dependencies

| Library | Purpose |
|---|---|
| `pandas` | Data manipulation |
| `numpy` | Numerical operations |
| `matplotlib` | Base plotting |
| `seaborn` | Statistical visualisation |
| `scipy` | Normal distribution fitting (`scipy.stats.norm`) |
| `databricks-sql-connector` | Databricks connection |
| `python-dotenv` | `.env` credential loading |

---

## Critical Gotchas

- **`load_dotenv("../.env")` must be the first cell** — see credential setup above.
- **`reported_scan_timestamp` is the scan time column**, not `timestamp`. Using `timestamp` returns the pipeline ingestion time, not when the hub actually saw the device.
- **Always exclude `bio_id_test_scan_results`** in every `WHERE` clause. Its artificial readings (~-20 dBm) appear in every query unless explicitly filtered.
- **`floor_timestamp()` must be implemented** (`utils/helpers.py`) before notebook 02 can run the bucketing comparison and wrangler validation sections.
- **Do not commit notebooks with outputs.** The query results include real device identifiers. Clear outputs before every commit.
