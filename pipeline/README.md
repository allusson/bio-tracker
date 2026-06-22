# pipeline/

Core algorithm stages of the localization pipeline. Each module takes the output of the previous stage and adds one layer of inference. Modules are controlled by `config.py` at the repo root.

---

## Files

### `wrangler.py` — RSSI-vector builder (Stage 1) — Implemented

Converts the raw long-format scan table into the wide-format RSSI vector table that the clustering stage needs. This is the pivotal transformation that makes multi-hub visibility usable: instead of separate rows per hub, each device-window pair becomes a single row with one column per hub.

### `clustering.py` — Zone discovery (Stage 2) — Stub

Will assign each RSSI vector to an inferred zone using unsupervised clustering. Three methods are planned, selected by `config.CLUSTERING_METHOD`: k-means (fast baseline, hard assignments), GMM (soft probabilistic assignments, better upstream input for the HMM), and DBSCAN (density-based, automatically determines the number of zones, marks noise as zone `-1`).

### `hmm.py` — Zone-sequence smoother (Stage 3) — Stub

Will smooth noisy per-window zone assignments into coherent movement trajectories using a Hidden Markov Model. Hidden states are the zones discovered by clustering. The transition matrix is learned from the data (empirical zone-to-zone transition frequencies). Viterbi decoding recovers the most probable zone sequence for each device over time.

---

## Key Functions

### `wrangle(df: pd.DataFrame) -> pd.DataFrame`  (`wrangler.py`)

```python
def wrangle(df: pd.DataFrame) -> pd.DataFrame
```

**Input:** Long-format DataFrame with columns `gateway_id | timestamp | device_id | rssi`.

**What it does:**

1. **Floor timestamps** to the nearest `WINDOW_MINUTES` boundary using `floor_timestamp()` from `utils/helpers.py`. The result is stored in a new `time_window` column.

2. **Pivot** from long to wide with `pd.pivot_table()`:
   - Index: `(device_id, time_window)` — one row per device per window
   - Columns: `gateway_id` — one column per hub
   - Values: `rssi`
   - `aggfunc="last"` — when a hub reports the same device more than once in a window, keep the last reading

   `NaN` means that hub did not see the device in that window.

3. **Filter** rows where fewer than `MIN_HUBS_PER_WINDOW` hubs have a non-NaN value. A vector with only one hub reading lacks directional information.

4. **Prints** a diagnostic summary: window counts before and after filtering, percentage of multi-hub windows, and an ASCII bar chart of the hub-count distribution.

**Output schema:**

MultiIndex `(device_id, time_window)` × hub columns (e.g. `Hub-A`, `Hub-B`, …). `NaN` where a hub did not see the device in that window.

```
                       Hub-A   Hub-B   Hub-C   Hub-D
device_id  time_window
Dev-01     2025-01-01 08:00  -55.12  -62.40     NaN  -78.00
           2025-01-01 08:20  -58.00  -61.10  -71.30     NaN
Dev-02     2025-01-01 08:00     NaN  -69.50  -74.20  -80.10
```

---

## Configuration (from `config.py`)

| Parameter | Default | Effect on wrangler |
|---|---|---|
| `WINDOW_MINUTES` | `20` | Size of each time bucket |
| `WINDOW_TOLERANCE_MINUTES` | `2` | Defined in config but not yet used inside wrangler |
| `MIN_HUBS_PER_WINDOW` | `2` | Minimum hubs required to keep a window |
| `CLUSTERING_METHOD` | `"kmeans"` | Used by `clustering.py` (stub) |
| `N_ZONES` | `4` | Used by k-means and GMM (stub) |
| `HMM_N_ITER` | `100` | HMM training iterations (stub) |

---

## Dependencies

| Library | Purpose |
|---|---|
| `pandas` | Pivoting, filtering, MultiIndex handling |
| `scikit-learn` | Clustering (k-means, GMM) — for `clustering.py` |
| `hmmlearn` | Hidden Markov Model + Viterbi — for `hmm.py` |

---

## Usage

```python
from synthetic_data.generator import generate
from pipeline.wrangler import wrangle
import config

df   = generate()    # or preprocessor.preprocess(databricks_pull.pull())
wide = wrangle(df)

print(wide.shape)    # (n_windows, n_hubs)
print(wide.head())
```

---

## Critical Gotchas

- **`aggfunc="last"` is row-order dependent, not time-order dependent.** `pd.pivot_table()` with `aggfunc="last"` keeps the last row in the current DataFrame order. It does not sort by timestamp internally. `preprocessor.preprocess()` sorts by `(device_id, timestamp)` before the data reaches `wrangle()`, so the ordering is correct for preprocessed real data. If you pass an unsorted DataFrame directly, the "last" reading may not be the chronologically most recent one.
- **20-minute window is not negotiable for real data.** BioHub nodes have independent fixed clock offsets reaching up to ~9.5 minutes across the hub population. This is a reporting artifact — the spread means hub report timestamps cannot be interpreted as the moment a device was exclusively in one hub's range. A 10-minute window (`WINDOW_MINUTES = 10`) splits hub reports for the same logical scan cycle across different buckets, fragmenting RSSI vectors. See `analysis/02_multi_hub_visibility.ipynb` for the empirical evidence.
- **NaN imputation needed before clustering.** The wide DataFrame contains `NaN` wherever a hub was out of range. `clustering.py` (once implemented) must impute or mask these values before passing vectors to scikit-learn estimators, which do not accept `NaN` inputs.
