# utils/helpers.py
#
# Shared utility functions used across multiple pipeline modules.

import pandas as pd
from datetime import timedelta


def floor_timestamp(ts: pd.Timestamp, window_minutes: int) -> pd.Timestamp:
    """Floor a timestamp down to the nearest window_minutes boundary.

    Args:
        ts: A pandas Timestamp to floor.
        window_minutes: Window size in minutes (e.g. 10).

    Returns:
        A new Timestamp truncated to the nearest window boundary below ts.
    """
    # PSEUDOCODE:
    #
    # Goal: snap ts to the most recent "on-the-grid" time, where the grid
    # ticks every window_minutes minutes (e.g. 08:00, 08:10, 08:20, ...).
    #
    # Step 1 — find how many minutes past the last grid tick we are:
    #       remainder = ts.minute % window_minutes
    #   Example: if ts.minute = 23 and window_minutes = 10,
    #            remainder = 23 % 10 = 3  (we are 3 minutes past 08:20)
    #
    # Step 2 — subtract that overshoot as a timedelta to land on the boundary:
    #       floored = ts - timedelta(minutes=remainder)
    #   Example: 08:23 - 3 min = 08:20  ✓
    #
    # Step 3 — zero out sub-minute precision so the result is a clean tick:
    #       floored = floored.replace(second=0, microsecond=0)
    #   Without this, 08:23:45 would floor to 08:20:45, not 08:20:00.
    #
    # Step 4 — return floored.
    #
    # NOTE: This works correctly for any window_minutes value that divides 60
    # evenly (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60).  For window values
    # like 7 or 11 that don't divide 60, the formula still produces a
    # repeatable bucket but the buckets won't align to clock hours — that's
    # acceptable for our use case since WINDOW_MINUTES = 10.
    remainder = ts.minute % window_minutes

    floored = ts - timedelta(minutes=remainder)

    floored = floored.replace(second=0, microsecond=0)

    return floored


def rssi_to_distance(rssi: float, rssi_ref: float, path_loss_exp: float) -> float:
    """Convert an RSSI reading to an estimated distance via the log-distance path loss model.

    Args:
        rssi: Measured signal strength in dBm (always negative, e.g. -65.0).
        rssi_ref: Expected RSSI at exactly 1 metre from the transmitter (e.g. -40.0 dBm).
        path_loss_exp: Path loss exponent n; 2.0 = free space, 3.0-4.0 = indoor.

    Returns:
        Estimated distance from transmitter to receiver in metres.
    """
    # PSEUDOCODE:
    #
    # The log-distance path loss model says signal drops with distance as:
    #   RSSI(d) = RSSI_ref - 10 * n * log10(d)
    #
    # Rearrange to solve for d:
    #   RSSI_ref - RSSI(d) = 10 * n * log10(d)
    #   log10(d) = (RSSI_ref - RSSI(d)) / (10 * n)
    #   d = 10 ^ ((RSSI_ref - RSSI) / (10 * n))
    #
    # Step 1 — compute the exponent:
    #       exp_val = (rssi_ref - rssi) / (10 * path_loss_exp)
    #   Example: rssi_ref=-40, rssi=-65, n=3.0
    #            exp_val = (-40 - -65) / (10 * 3.0) = 25 / 30 ≈ 0.833
    #
    # Step 2 — raise 10 to that power to get distance:
    #       distance = 10 ** exp_val
    #   Example: 10 ** 0.833 ≈ 6.8 metres
    #
    # Step 3 — return distance.
    #
    # Hint: Python uses ** for exponentiation.  math.pow(10, exp_val) is
    # equivalent but slightly slower — either is fine.
    pass


def load_data(use_synthetic: bool | None = None) -> pd.DataFrame:
    """Load pipeline data from either the synthetic generator or Databricks.

    Args:
        use_synthetic: True → generate synthetic data; False → pull from
            Databricks and preprocess; None → read config.USE_SYNTHETIC.

    Returns:
        Clean DataFrame with columns:
            gateway_id | timestamp | device_id | rssi
    """
    # PSEUDOCODE:
    #
    # Step 1 — resolve the flag from config if the caller didn't specify:
    #       if use_synthetic is None:
    #           import config
    #           use_synthetic = config.USE_SYNTHETIC
    #
    # Step 2 — branch on the flag:
    #
    #   if use_synthetic is True:
    #       from synthetic_data import generator
    #       return generator.generate()
    #       # generator.generate() returns a DataFrame in the standard format
    #
    #   else:
    #       from real_data import databricks_pull, preprocessor
    #       raw_df = databricks_pull.pull()     # raw Databricks schema
    #       return preprocessor.preprocess(raw_df)  # clean, standardised schema
    #
    # NOTE: Both branches must return a DataFrame with identical column names
    # (gateway_id, timestamp, device_id, rssi) so the rest of the pipeline
    # doesn't need to know which source was used.
    pass
