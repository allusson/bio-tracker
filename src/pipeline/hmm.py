# pipeline/hmm.py
#
# Stage 3: smooths noisy zone assignments into clean movement trajectories.
#
# Input: DataFrame with 'zone' column from clustering.py
# Output: same DataFrame with a 'smoothed_zone' column (Viterbi-decoded)
#
# Approach:
#   - Hidden states = zones discovered by clustering
#   - Emissions = RSSI vectors (or cluster probabilities from GMM)
#   - Transition matrix learned from the data itself (how often zone A → zone B)
#   - Viterbi algorithm recovers the most plausible zone sequence over time

# TODO: implement per-device sequence extraction
# TODO: implement transition matrix estimation
# TODO: implement emission model (from GMM or discretised RSSI)
# TODO: implement Viterbi decoding via hmmlearn
# TODO: attach smoothed_zone back to DataFrame
