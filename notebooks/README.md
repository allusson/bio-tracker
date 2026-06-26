# Notebooks

Jupyter notebooks for data exploration, analysis, and pipeline validation.
These notebooks import from `src/` and `utils/` using `sys.path.insert(0, "..")`.
Run from the `notebooks/` directory or via Jupyter launched from the repo root.

| Notebook | Status | Description |
|----------|--------|-------------|
| 01_data_overview | Complete | Real data characterisation and gateway clock offset analysis |
| 02_multi_hub_visibility | Complete | Clock offset validation and 20-min bucketing justification |
| 03_synthetic_vs_real | Skeleton | Synthetic vs real data calibration (not yet implemented) |
| 04_windowing_reassessment | Complete | Window-width sweep, cadence analysis, phase drift characterisation |
