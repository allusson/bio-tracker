# real_data/preprocessor.py
#
# Cleans and standardises raw real data pulled from Databricks so it matches
# the format that the pipeline expects — identical to synthetic data output.
#
# Steps:
#   1. Keep only the four relevant columns
#   2. Parse reported_scan_timestamp to datetime
#   3. Drop rows with null gateway_id, device_id, or rssi
#   4. Rename columns to internal pipeline names if needed
#   5. Sort by device and timestamp

import pandas as pd


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Clean and standardise a raw Databricks RSSI DataFrame.

    Args:
        df: Raw DataFrame from databricks_pull.pull().  Expected to contain at
            minimum the Databricks columns:
                gateway_id | reported_scan_timestamp | scanned_device_id | rssi

    Returns:
        Clean DataFrame with standardised internal pipeline column names:
            gateway_id | timestamp | device_id | rssi
        Timestamps are UTC-aware pd.Timestamp objects.  Rows with nulls or
        physically implausible RSSI values have been removed.
    """
    # Step 1: Keep only the four columns the pipeline needs.
    # Any extra columns Databricks returns are irrelevant and waste memory.
    raw_cols = ["gateway_id", "reported_scan_timestamp", "scanned_device_id", "rssi"]
    df = df[raw_cols].copy()   # .copy() prevents SettingWithCopyWarning on later assignments

    # Step 2: Rename Databricks column names to shorter internal pipeline names.
    # We do this early so the rest of the function can use the cleaner names.
    df = df.rename(columns={
        "reported_scan_timestamp": "timestamp",
        "scanned_device_id": "device_id",
    })

    # Step 3: Parse the timestamp column to UTC-aware datetime objects.
    # NOTE: pd.to_datetime(..., utc=True) does two things at once:
    #   1. Converts strings / integers / tz-naive datetimes to pd.Timestamp.
    #   2. Localises or converts the timezone to UTC.
    # Without utc=True, timestamps from Databricks may arrive as tz-naive
    # strings (e.g. "2025-01-01 08:00:00") which would break any comparison
    # against tz-aware timestamps later in the pipeline.
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    # Step 4: Drop rows missing any of the three mandatory fields.
    # A row with no gateway_id can't tell us which hub saw the device.
    # A row with no device_id or rssi is completely uninformative.
    before_null_drop = len(df)
    df = df.dropna(subset=["gateway_id", "device_id", "rssi"])
    n_dropped_null = before_null_drop - len(df)
    if n_dropped_null:
        print(f"[preprocessor] Dropped {n_dropped_null:,} rows with null key fields.")

    # Step 5: Drop rows with physically implausible RSSI values.
    # NOTE: BLE RSSI is always expressed as a negative dBm value.
    #   • Readings above 0 dBm are physically impossible and indicate corrupt data.
    #   • Readings below -100 dBm are below the sensitivity floor of virtually
    #     every BLE chipset, so they are also treated as corrupt.
    # The range (-100, 0] covers everything from a device pressed against the
    # hub all the way to the practical edge of detection.
    before_rssi_drop = len(df)
    df = df[(df["rssi"] >= -100) & (df["rssi"] <= 0)]
    n_dropped_rssi = before_rssi_drop - len(df)
    if n_dropped_rssi:
        print(f"[preprocessor] Dropped {n_dropped_rssi:,} rows with out-of-range RSSI.")

    # Step 6: Sort so each device's scan history is in chronological order.
    # This isn't strictly required for the pivot but makes debugging far easier
    # and is a cheap operation relative to the size of the dataset.
    df = df.sort_values(["device_id", "timestamp"]).reset_index(drop=True)

    # Step 7: Print a brief sanity-check summary before returning.
    n_devices  = df["device_id"].nunique()
    n_gateways = df["gateway_id"].nunique()
    date_min   = df["timestamp"].min()
    date_max   = df["timestamp"].max()
    print(
        f"[preprocessor] Kept {len(df):,} rows | "
        f"{n_devices} devices | "
        f"{n_gateways} gateways | "
        f"{date_min} → {date_max}"
    )

    return df
