# pipeline/clustering.py
#
# Stage 2: discovers implicit zones from RSSI vector similarity.
#
# Input: RSSI vector DataFrame from wrangler.py (NaN filled with a sentinel value)
# Output: same DataFrame with an added 'zone' column
#
# Methods (controlled by config.CLUSTERING_METHOD):
#   - kmeans:  fast baseline, hard zone assignments
#   - gmm:     soft probabilistic assignments (better for HMM downstream)
#   - dbscan:  density-based, no need to specify N_ZONES, flags noise as -1

# TODO: implement NaN handling / imputation strategy
# TODO: implement k-means path
# TODO: implement GMM path
# TODO: implement DBSCAN path
# TODO: evaluate cluster quality (silhouette score)
