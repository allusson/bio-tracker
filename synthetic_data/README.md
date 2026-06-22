# synthetic_data/

Generates a synthetic RSSI dataset that mimics real BioHub scan telemetry. Used for offline pipeline development and testing when a Databricks connection is not available or when you want a reproducible dataset with known ground truth positions.

---

## Files

### `config.py` — Generator parameters

All tunable constants for the simulation. Change values here rather than inside `generator.py`.

| Parameter | Default | Description |
|---|---|---|
| `SPACE_WIDTH` | `100` m | Width of the simulated floor |
| `SPACE_HEIGHT` | `60` m | Height of the simulated floor |
| `N_HUBS` | `4` | Number of virtual BioHub gateways to place |
| `HUB_POSITIONS` | `None` | Explicit `(x, y)` positions in metres; if `None`, hubs are auto-arranged in a grid |
| `N_DEVICES` | `6` | Number of virtual BioButton devices to simulate |
| `SIM_DURATION_HOURS` | `8` | Duration of the simulation in hours |
| `RSSI_REF` | `-40` dBm | Expected RSSI at exactly 1 metre from a hub |
| `PATH_LOSS_EXP` | `3.0` | Path loss exponent; 2.0 = free space, 3.0–4.0 = indoor with walls |
| `NOISE_STD` | `4.0` dB | Standard deviation of Gaussian noise added to each reading |
| `RSSI_MIN_THRESHOLD` | `-90` dBm | Readings weaker than this are not recorded (simulates sensitivity floor) |
| `SCAN_WINDOW_MINUTES` | `20` | How often a hub reports; matches the real hub reporting interval |

### `generator.py` — Simulation engine

Simulates hub placement, device movement, and RSSI measurement. Outputs a DataFrame in the same long format as the real Databricks table so the rest of the pipeline is data-source agnostic.

---

## Key Functions

### `_place_hubs() -> dict[str, tuple[float, float]]`

Places virtual hubs either at explicitly configured positions (`config.HUB_POSITIONS`) or automatically in an evenly-spaced grid. The grid algorithm computes `ncols = ceil(sqrt(N))` and fills positions left-to-right, top-to-bottom, centred in each grid cell. Returns a mapping of hub ID (e.g. `"Hub-A"`) to `(x, y)` position in metres.

### `generate() -> pd.DataFrame`

Main simulation entry point. Uses a fixed random seed (`seed=42`) so output is reproducible across runs.

**What it does, step by step:**

1. Places hubs via `_place_hubs()`.
2. Builds a sequence of `n_steps = SIM_DURATION_HOURS × 60 / SCAN_WINDOW_MINUTES` timestamps starting at `2025-01-01 08:00:00`.
3. Initialises each device at a random `(x, y)` position within the floor bounds.
4. For each timestamp and each device, advances the device position by a **random walk**: displacement drawn from `N(0, 3.0²)` in both x and y, then clamped to floor boundaries.
5. For each hub, computes RSSI using the **log-distance path loss model**:

   ```
   RSSI(d) = RSSI_REF − 10 · PATH_LOSS_EXP · log₁₀(d)
   ```

   where `d` is Euclidean distance in metres, floored to 0.1 m to avoid `log10(0)`.

6. Adds Gaussian noise: `RSSI += N(0, NOISE_STD²)`.
7. Drops readings below `RSSI_MIN_THRESHOLD` (simulates limited range).
8. Returns all surviving observations as a DataFrame.

**Output schema:**

| Column | Type | Notes |
|---|---|---|
| `gateway_id` | str | e.g. `"Hub-A"`, `"Hub-B"` |
| `timestamp` | datetime | One per `SCAN_WINDOW_MINUTES` reporting interval |
| `device_id` | str | e.g. `"Dev-01"` through `"Dev-06"` |
| `rssi` | float | dBm, rounded to 2 decimal places; always ≤ 0 |

> **Performance note:** Rows are collected into a plain Python list and converted to a DataFrame in a single `pd.DataFrame()` call at the end. Appending rows to a DataFrame in a loop would cause O(n²) memory copies and should be avoided.

### `main() -> None`

CLI entry point: calls `generate()`, creates `outputs/` if needed, and saves the result to `outputs/synthetic_data.csv`.

---

## Path Loss Model

The log-distance path loss model used in the generator:

```
RSSI(d) = RSSI_REF − 10 · n · log₁₀(d)
```

where:
- `RSSI_REF = -40 dBm` — signal strength at 1 m reference distance
- `n = PATH_LOSS_EXP = 3.0` — path loss exponent (indoor environment)
- `d` — distance from hub to device in metres

Real-world RSSI fluctuates due to multipath and body shadowing; the generator adds `N(0, NOISE_STD²)` noise (default σ = 4.0 dB) to approximate this.

The `docs/js/rssi.js` sandbox uses slightly different constants (`RSSI_AT_1M = -45`, `PATH_LOSS_EXP = 2.7`, `WALL_ATTENUATION_DB = 12`) for interactive visualisation purposes.

---

## Dependencies

| Library | Purpose |
|---|---|
| `numpy` | Random number generation, array math |
| `pandas` | DataFrame construction and CSV output |

---

## Usage

```bash
# Run as a script — generates outputs/synthetic_data.csv
python synthetic_data/generator.py
```

```python
# Import directly from another module or notebook
from synthetic_data.generator import generate

df = generate()   # returns long-format DataFrame
print(df.head())
```

---

## Notes and Caveats

- **No clock offsets:** The generator assigns every hub the same timestamp for each time step. Real BioHub nodes have fixed per-hub clock offsets spanning up to ~9.5 minutes. Notebook `03_synthetic_vs_real.ipynb` (skeleton) is intended to identify whether per-hub offsets need to be added to the generator for accurate calibration.
- **Movement model:** The 3.0 m/step random walk is a rough approximation of patient mobility in a hospital setting. Adjust `step_size` (hardcoded in `generate()`, line 126) to simulate faster or slower movement.
- **Seed:** The `seed=42` in `generate()` makes the output fully deterministic. Remove or parameterise the seed to generate varied datasets.
