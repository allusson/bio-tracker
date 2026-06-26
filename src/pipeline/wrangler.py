# pipeline/wrangler.py
#
# Stage 1: transforms raw hub-device-RSSI rows into RSSI vectors.
#
# Input (one row per hub-device observation):
#   gateway_id | timestamp | device_id | rssi
#
# Output (one row per device per time window, hubs as columns):
#   device_id | time_window | Hub-A | Hub-B | Hub-C | ...
#
# Steps:
#   1. Floor timestamps to the nearest WINDOW_MINUTES bucket
#   2. Pivot: device+window as index, gateway_id as columns, rssi as values
#   3. Filter out windows with fewer than MIN_HUBS_PER_WINDOW visible hubs
#   4. Report multi-hub visibility statistics

import pandas as pd

import config
from utils.helpers import floor_timestamp


def wrangle(df: pd.DataFrame) -> pd.DataFrame:
    """Pivot raw RSSI observations into per-device, per-window RSSI vectors.

    Args:
        df: DataFrame with columns:
                gateway_id | timestamp | device_id | rssi
            One row per hub-device observation.  Timestamps may be tz-aware or
            tz-naive; both are handled.

    Returns:
        Pivoted DataFrame indexed by (device_id, time_window).
        Columns are hub IDs (e.g. "Hub-A", "Hub-B", …).
        NaN means that hub did not see this device in this window.
        Rows with fewer than MIN_HUBS_PER_WINDOW non-NaN values are removed.
    """
    # Work on a copy so callers' DataFrames are not modified in place
    df = df.copy()

    # Step 1: Floor each timestamp to the nearest WINDOW_MINUTES boundary.
    # This collapses all readings within a 10-minute window into a single bucket
    # so we can later aggregate them.  The result is stored in a new column
    # "time_window" to distinguish it from the original raw timestamp.
    #
    # NOTE: We apply floor_timestamp row-by-row with .apply().
    # An alternative (and faster for large DataFrames) is vectorised arithmetic:
    #   df["time_window"] = df["timestamp"].dt.floor(f"{config.WINDOW_MINUTES}min")
    # but .apply(floor_timestamp, ...) uses the function the developer is being
    # asked to implement, which is the point of the exercise.
    df["time_window"] = df["timestamp"].apply(
        floor_timestamp, window_minutes=config.WINDOW_MINUTES
    )

    total_windows_before = df.groupby(["device_id", "time_window"]).ngroups

    # Step 2: Pivot the long-format table into a wide RSSI vector table.
    #
    # NOTE: pd.pivot_table() is the pandas way to reshape data from "long"
    # (one row per observation) to "wide" (one row per subject, one column per
    # variable).  Think of it like a SQL GROUP BY + conditional aggregation.
    #
    #   Before pivot (long):                After pivot (wide):
    #   device | window | hub  | rssi       device | window | Hub-A | Hub-B
    #   Dev-01 | 08:00  | Hub-A | -55       Dev-01 | 08:00  |  -55  |  -62
    #   Dev-01 | 08:00  | Hub-B | -62       Dev-01 | 08:10  |  NaN  |  -70
    #   Dev-01 | 08:10  | Hub-B | -70
    #
    # aggfunc="last" means: if a hub reports the same device more than once in
    # a window (can happen at window boundaries), keep the most recent reading.
    # This matches the real hub behaviour described in the data spec.
    pivoted = pd.pivot_table(
        df,
        index=["device_id", "time_window"],   # one row per device per window
        columns="gateway_id",                  # one column per hub
        values="rssi",
        aggfunc="last",                        # last RSSI reported in the window
    )

    # pivot_table names the column axis "gateway_id" — remove that label so
    # hub names (Hub-A, Hub-B, …) appear as plain column names, not as a
    # MultiIndex level.
    pivoted.columns.name = None

    # Step 3: Filter out windows where too few hubs saw the device.
    # An RSSI vector with only one non-NaN value is essentially a 1-D point —
    # there is not enough directional information to locate the device.
    # MIN_HUBS_PER_WINDOW = 2 means we require at least two hubs to have a
    # reading before we trust the observation for clustering.
    #
    # NOTE: .notna() produces a boolean DataFrame (True where value is present).
    # .sum(axis=1) then counts True values across columns (= per row), giving
    # the number of hubs that saw this device in this window.
    hub_counts = pivoted.notna().sum(axis=1)   # Series: n_hubs per (device, window)
    total_windows_before_filter = len(pivoted)

    pivoted = pivoted[hub_counts >= config.MIN_HUBS_PER_WINDOW]

    total_windows_after_filter = len(pivoted)

    # Step 4: Print statistics so the developer can see data quality at a glance.
    n_dropped = total_windows_before_filter - total_windows_after_filter
    pct_multi = (
        (hub_counts >= 2).sum() / len(hub_counts) * 100
        if len(hub_counts) > 0 else 0.0
    )

    print(f"[wrangler] Time windows before filtering : {total_windows_before_filter:,}")
    print(f"[wrangler] Time windows after  filtering : {total_windows_after_filter:,}  "
          f"({n_dropped:,} dropped, < {config.MIN_HUBS_PER_WINDOW} hubs)")
    print(f"[wrangler] Windows with ≥2 hub visibility: {pct_multi:.1f}%")

    # Distribution of hub counts across all kept windows
    kept_counts = pivoted.notna().sum(axis=1)
    distribution = kept_counts.value_counts().sort_index()
    print("[wrangler] Hub-count distribution (kept windows):")
    for n_hubs, freq in distribution.items():
        bar = "█" * int(freq / max(distribution) * 20)   # simple ASCII bar
        print(f"           {n_hubs} hub(s): {freq:>5,}  {bar}")

    return pivoted
