# real_data/databricks_pull.py
#
# Connects to Databricks and pulls raw scan telemetry into a pandas DataFrame.
#
# The query targets:
#   etl_device_telemetry_bronze.gateway_scan_telemetry
#
# Only the four columns relevant to the pipeline are fetched:
#   gateway_id | reported_scan_timestamp | scanned_device_id | rssi

# TODO: set up Databricks SDK connection
# TODO: define and run SQL query with optional date range filter
# TODO: return raw DataFrame
