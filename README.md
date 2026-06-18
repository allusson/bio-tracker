# Bio-Tracker

Indoor location tracking and movement analysis for BioButton wearable devices,
using Bluetooth RSSI data collected from BioHub anchor nodes.

## Project Overview

BioButton devices are passively scanned by BioHub gateways installed throughout
hospital facilities. Each hub logs the RSSI (signal strength) of every device it
sees in a 10-minute window. By combining readings across multiple hubs, this
pipeline infers device location, zone occupancy, and movement patterns — with
no floor plan or labeled ground truth required.

## Pipeline Summary

1. **Wrangling** — pivot raw hub-device-RSSI rows into RSSI vectors per device per time window
2. **Clustering** — discover implicit zones from RSSI vector similarity (k-means / GMM)
3. **HMM** — smooth noisy zone assignments into clean movement trajectories
4. **Demo** — visualize zone heatmaps, movement traces, and occupancy statistics

## Repository Structure

```
bio-tracker/
├── config.py            # central configuration (window size, algorithm params, etc.)
├── synthetic_data/      # synthetic RSSI dataset generator for development/testing
├── real_data/           # Databricks data pull and preprocessing scripts
├── pipeline/            # core algorithm modules (wrangler, clustering, HMM)
├── demo/                # GUI and visualization
├── utils/               # shared helper functions
└── outputs/             # generated plots and results (gitignored)
```

## Setup

```bash
pip install -r requirements.txt
```

## Usage

```bash
# Generate synthetic data for testing
python synthetic_data/generator.py

# Run the full pipeline on synthetic data
python pipeline/wrangler.py
```
