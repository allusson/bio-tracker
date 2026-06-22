# config.py
# Central configuration for the bio-tracker pipeline.
# Change parameters here rather than inside individual scripts.

# --- Data source ---
# Toggle between synthetic and real data
USE_SYNTHETIC = True

# --- Time windowing ---
# Size of the time bucket used to group hub readings into RSSI vectors.
# Should match the hub scan/upload interval (currently 10 minutes for real data).
WINDOW_MINUTES = 20

# Tolerance when aligning timestamps across hubs (in minutes).
# Readings within this tolerance of a window boundary are grouped together.
WINDOW_TOLERANCE_MINUTES = 2

# Minimum number of hubs that must see a device in a window for that
# observation to be included in clustering. Set to 1 to keep all data,
# 2+ to enforce multi-hub visibility (recommended for clustering quality).
MIN_HUBS_PER_WINDOW = 2

# --- Clustering ---
CLUSTERING_METHOD = "kmeans"   # options: "kmeans", "gmm", "dbscan"
N_ZONES = 4                    # number of zones (k-means / GMM only)

# --- HMM ---
HMM_N_ITER = 100               # number of training iterations

# --- Output ---
OUTPUT_DIR = "outputs/"
