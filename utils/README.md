# utils/

Shared utility functions used across multiple pipeline modules. Import from here rather than duplicating logic across `pipeline/`, `real_data/`, and `analysis/`.

---

## Files

### `helpers.py` — Shared utilities

**Status: student implementation in progress.** All three functions are being written as a Python learning exercise. Each function has its intended signature, docstring, and pseudocode; the implementations themselves should not be assumed complete or stable.

---

## Functions

### `floor_timestamp(ts, window_minutes) -> pd.Timestamp`

```python
def floor_timestamp(ts: pd.Timestamp, window_minutes: int) -> pd.Timestamp
```

**Student implementation in progress.**

Floors a timestamp down to the nearest `window_minutes` boundary. For example, with `window_minutes=20`, a timestamp of `08:23:45` should return `08:20:00`.

Intended behavior:
- Finds how many minutes past the last grid boundary the timestamp is (`ts.minute % window_minutes`).
- Subtracts that overshoot as a `timedelta`.
- Zeros out sub-minute precision (seconds, microseconds) so the result is a clean boundary tick.

Works correctly for any `window_minutes` value that evenly divides 60 (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60). For values that don't divide 60, it still produces a repeatable bucket but buckets won't align to clock hours.

**Called by:** `pipeline/wrangler.py` and `analysis/02_multi_hub_visibility.ipynb`.

---

### `rssi_to_distance(rssi, rssi_ref, path_loss_exp) -> float`

```python
def rssi_to_distance(rssi: float, rssi_ref: float, path_loss_exp: float) -> float
```

**Student implementation in progress.**

Converts an RSSI reading to an estimated distance using the inverse log-distance path loss model:

```
RSSI(d) = RSSI_ref − 10 · n · log₁₀(d)
```

Rearranged to solve for d:

```
d = 10 ^ ((RSSI_ref − RSSI) / (10 · n))
```

**Arguments:**
- `rssi` — measured signal strength in dBm (always negative, e.g. `-65.0`)
- `rssi_ref` — expected RSSI at exactly 1 metre from the transmitter (e.g. `-40.0` dBm)
- `path_loss_exp` — path loss exponent `n`; 2.0 = free space, 3.0–4.0 = indoor

**Returns:** Estimated distance in metres.

Useful for Stage 3 (MDS pseudo-map): converting hub-device RSSI readings into pairwise distance estimates for multidimensional scaling.

---

### `load_data(use_synthetic) -> pd.DataFrame`

```python
def load_data(use_synthetic: bool | None = None) -> pd.DataFrame
```

**Student implementation in progress.**

Unified data loader: returns a clean long-format DataFrame regardless of whether the source is synthetic or real.

- If `use_synthetic=True`: calls `synthetic_data.generator.generate()`.
- If `use_synthetic=False`: calls `real_data.databricks_pull.pull()` then `real_data.preprocessor.preprocess()`.
- If `use_synthetic=None` (default): reads `config.USE_SYNTHETIC`.

Both branches must return a DataFrame with identical column names (`gateway_id`, `timestamp`, `device_id`, `rssi`) so the rest of the pipeline is data-source agnostic.

---

## Dependencies

| Library | Purpose |
|---|---|
| `pandas` | `pd.Timestamp` type used in `floor_timestamp` |
| `datetime` | `timedelta` used in `floor_timestamp` |

---

## Usage

```python
from utils.helpers import floor_timestamp, rssi_to_distance, load_data

# Floor a timestamp to the nearest 20-minute boundary
import pandas as pd
ts = pd.Timestamp("2025-01-01 08:23:45")
print(floor_timestamp(ts, window_minutes=20))   # 2025-01-01 08:20:00

# Estimate distance from RSSI
dist = rssi_to_distance(rssi=-65.0, rssi_ref=-40.0, path_loss_exp=3.0)

# Load data (source controlled by config.USE_SYNTHETIC)
df = load_data()
```
