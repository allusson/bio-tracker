# synthetic_data/generator.py
#
# Generates a synthetic RSSI dataset that mimics real BioHub scan telemetry.
#
# The output is a DataFrame (and optionally a CSV) with the same column
# structure as the real Databricks table:
#   gateway_id | timestamp | device_id | rssi
#
# Approach:
#   - Define a set of virtual hubs placed at known 2D coordinates
#   - Define a set of virtual devices that move through the space over time
#   - At each time step, compute RSSI from each hub to each device using a
#     log-distance path loss model with added Gaussian noise
#   - Only record a hub-device reading if the signal is above a threshold
#     (simulating limited scan range)
#   - Output one row per hub-device observation, matching the real data format

import math
import os
import string
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from synthetic_data import config


# ---------------------------------------------------------------------------
# Hub placement
# ---------------------------------------------------------------------------

def _place_hubs() -> dict[str, tuple[float, float]]:
    """Place hubs from config or auto-arrange in an evenly-spaced grid.

    Returns:
        Mapping of hub ID (e.g. "Hub-A") to (x, y) position in metres.
    """
    if config.HUB_POSITIONS is not None:
        # Use the explicit positions provided in config; label them A, B, C, …
        return {
            f"Hub-{string.ascii_uppercase[i]}": pos
            for i, pos in enumerate(config.HUB_POSITIONS)
        }

    # NOTE: Auto-grid placement.
    # For N hubs we want the grid to be as square as possible, so we compute
    # ncols = ceil(sqrt(N)).  Then nrows fills upward to fit all hubs.
    # Hubs are placed at the centre of each grid cell so they're evenly spread.
    n = config.N_HUBS
    ncols = math.ceil(math.sqrt(n))   # columns in the grid
    nrows = math.ceil(n / ncols)      # rows needed to fit all N hubs

    # Compute the x-centre of each column and y-centre of each row
    xs = [config.SPACE_WIDTH  * (c + 0.5) / ncols for c in range(ncols)]
    ys = [config.SPACE_HEIGHT * (r + 0.5) / nrows for r in range(nrows)]

    hubs: dict[str, tuple[float, float]] = {}
    for i in range(n):
        row, col = divmod(i, ncols)   # fill left-to-right, top-to-bottom
        label = f"Hub-{string.ascii_uppercase[i]}"
        hubs[label] = (xs[col], ys[row])

    return hubs


# ---------------------------------------------------------------------------
# Main generation function
# ---------------------------------------------------------------------------

def generate() -> pd.DataFrame:
    """Generate a synthetic RSSI scan DataFrame mimicking real BioHub telemetry.

    Returns:
        DataFrame with columns:
            gateway_id | timestamp | device_id | rssi
        One row per hub-device pair that was within detection range at each
        simulated time step.
    """
    # Seeded RNG so the output is reproducible across runs
    rng = np.random.default_rng(seed=42)

    hubs = _place_hubs()
    print(f"[generator] Placed {len(hubs)} hubs: {list(hubs.keys())}")

    # Build the sequence of simulation timestamps.
    # Each step represents one SCAN_WINDOW_MINUTES reporting interval.
    n_steps = int(config.SIM_DURATION_HOURS * 60 / config.SCAN_WINDOW_MINUTES)
    t0 = datetime(2025, 1, 1, 8, 0, 0)   # simulation starts at 08:00
    timestamps = [
        t0 + timedelta(minutes=i * config.SCAN_WINDOW_MINUTES)
        for i in range(n_steps)
    ]

    # Initialise each device at a random (x, y) position within the floor bounds
    device_positions: dict[str, np.ndarray] = {}
    for d in range(config.N_DEVICES):
        device_id = f"Dev-{d + 1:02d}"
        x = rng.uniform(0, config.SPACE_WIDTH)
        y = rng.uniform(0, config.SPACE_HEIGHT)
        device_positions[device_id] = np.array([x, y], dtype=float)

    print(
        f"[generator] Simulating {config.N_DEVICES} devices "
        f"over {n_steps} time steps ({config.SIM_DURATION_HOURS} h) …"
    )

    # Collect observations into a list of dicts.
    # NOTE: Building a list of dicts and calling pd.DataFrame() once at the end
    # is far more efficient than appending rows to a DataFrame in a loop.
    # DataFrame.append() (now removed) and pd.concat() inside a loop both
    # reallocate the entire underlying array on every iteration — O(n²) memory
    # copies.  A Python list.append() is O(1) amortised.
    rows: list[dict] = []

    for ts in timestamps:
        for device_id, pos in device_positions.items():

            # --- Random walk: update device position for this time step ---
            # NOTE: A random walk (Brownian motion) is a standard model for
            # unconstrained movement.  At each step we draw a displacement from
            # N(0, step_size²) in both x and y.  The device is equally likely to
            # move in any direction, and tends to drift slowly rather than jumping
            # across the room.
            step_size = 3.0   # metres per time window — tune to match real mobility
            dx = rng.normal(0, step_size)
            dy = rng.normal(0, step_size)

            # Clamp to floor boundaries so the device can't walk through walls.
            # np.clip(value, min, max) is equivalent to max(min, min(value, max)).
            pos[0] = float(np.clip(pos[0] + dx, 0.0, config.SPACE_WIDTH))
            pos[1] = float(np.clip(pos[1] + dy, 0.0, config.SPACE_HEIGHT))

            for hub_id, (hx, hy) in hubs.items():

                # Euclidean distance from this hub to the current device position
                distance = math.sqrt((pos[0] - hx) ** 2 + (pos[1] - hy) ** 2)

                # Guard against log10(0) if the device lands exactly on a hub
                distance = max(distance, 0.1)   # floor to 10 cm

                # NOTE: Log-distance path loss model.
                # Real BLE RSSI decreases logarithmically with distance:
                #   RSSI(d) = RSSI_ref - 10 * n * log10(d)
                # where n (PATH_LOSS_EXP) captures how much the environment
                # attenuates the signal: 2.0 = open air, 3.0–4.0 = indoor with
                # walls and furniture.  RSSI_REF is the measured signal at 1 m.
                rssi = (
                    config.RSSI_REF
                    - 10.0 * config.PATH_LOSS_EXP * math.log10(distance)
                )

                # Add Gaussian noise to simulate real-world measurement variability.
                # Real RSSI readings fluctuate due to multipath, body shadowing, etc.
                rssi += float(rng.normal(0.0, config.NOISE_STD))

                # Discard readings that are below the receiver sensitivity floor.
                # In practice, hubs don't report devices they can barely hear.
                if rssi < config.RSSI_MIN_THRESHOLD:
                    continue

                rows.append({
                    "gateway_id": hub_id,
                    "timestamp": ts,
                    "device_id": device_id,
                    "rssi": round(rssi, 2),   # 2 decimal places matches real data precision
                })

    df = pd.DataFrame(rows, columns=["gateway_id", "timestamp", "device_id", "rssi"])
    print(f"[generator] Generated {len(df):,} observations.")
    return df


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Generate synthetic data and save to outputs/synthetic_data.csv."""
    import sys
    import os
    # Add the project root to sys.path so we can import the top-level config
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    import config as root_config

    df = generate()

    os.makedirs(root_config.OUTPUT_DIR, exist_ok=True)
    out_path = os.path.join(root_config.OUTPUT_DIR, "synthetic_data.csv")
    df.to_csv(out_path, index=False)
    print(f"[generator] Saved {len(df):,} rows to {out_path}")


if __name__ == "__main__":
    main()
