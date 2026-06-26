# synthetic_data/config.py
#
# Parameters controlling synthetic data generation.
# Tweak these to stress-test the pipeline under different conditions.

# --- Space ---
SPACE_WIDTH  = 100   # metres, width of simulated floor
SPACE_HEIGHT = 60    # metres, height of simulated floor

# --- Hubs ---
N_HUBS = 4
# Hub positions as (x, y) tuples in metres.
# If None, hubs are placed automatically in a grid.
HUB_POSITIONS = None

# --- Devices ---
N_DEVICES = 6
# Duration of the simulation in hours
SIM_DURATION_HOURS = 8

# --- BLE Path Loss Model ---
# RSSI at 1 metre reference distance (dBm)
RSSI_REF = -40
# Path loss exponent (2.0 = free space, 3.0-4.0 = indoors/walls)
PATH_LOSS_EXP = 3.0
# Standard deviation of Gaussian noise added to each RSSI reading (dB)
NOISE_STD = 4.0
# Minimum RSSI threshold — readings weaker than this are not recorded
RSSI_MIN_THRESHOLD = -90

# --- Scan timing ---
# How often a hub reports a scan result (minutes) — matches real hub behaviour
SCAN_WINDOW_MINUTES = 20
