# Windowing Strategy Reassessment
## bio-tracker · BLE Indoor Localization Pipeline

> **Purpose:** Organize the analysis agenda following supervisor feedback on the 20-minute bucketing window. This document records the problem framing, open questions, and actionable plans for a research-oriented reassessment notebook.

---

## 1. Background & Problem Framing

### The core synchronization problem
BioHub gateway nodes each run an independent ~10-minute scan/report loop that begins from their individual boot time. This gives every hub a **stable, fixed phase offset** relative to every other hub. Across the observed hub population, the spread of `reported_scan_timestamp` values for the same logical scan event reaches up to **~9 minutes 25 seconds**.

This spread is a **reporting artifact, not a movement signal.** All co-located hubs observed the device simultaneously — they reported at different wall-clock times because their loops started at different boot times.

### Why bucketing exists at all
The raw data has a critical sparsity problem: **99.5% of raw observations are single-hub; only 0.5% are simultaneously multi-hub** (from `01_data_overview.ipynb`). The entire pipeline depends on temporal aggregation to *manufacture* multi-hub RSSI vectors. Without some form of bucketing, nearly all windows have only one hub and carry no spatial information.

### The fundamental tension
Two pressures pull in opposite directions when choosing a window width:

| Pressure | Direction | Effect |
|---|---|---|
| **Coverage** | Wider window | More co-observing hubs per vector → better localizability |
| **Coherence** | Narrower window | Device position is more stable within the window → less position smearing |
| **Double-report risk** | Narrower window | A single hub reporting twice per window is less likely to collide |

The 20-minute floor is the current brute-force resolution of this tension. The reassessment asks: **is this the best we can do, and can we back it up with real numbers?**

### Why the "2 × cadence" framing is cleaner than "9.5 minutes"
If hub offsets are approximately uniformly distributed over [0, 10 min), then for any device seen by enough hubs the earliest-to-latest spread will structurally approach one full cadence (~10 min). The observed 9.5-min spread isn't a magic number — it's just "close to one cadence." The defensible framing is:

> **`WINDOW = 2 × cadence`** guarantees that any two hubs, regardless of their offsets, land in the same bucket.

This means the *real* risk variable is the **cadence itself**, not the observed spread. If cadence ≠ 10.000 min (drift, jitter, firmware variability), the 20-min window may not be sufficient indefinitely.

---

## 2. What Has (and Has Not) Been Validated

### Validated (empirically)
- One sample device (`t42032c01422c1d01380c1401`) over a 4-hour window produces 9–10 hubs per 20-min bucket consistently.
- 10-min bucketing demonstrably splits hub reports for the same logical scan event across adjacent buckets.
- Each hub has a visually distinguishable fixed offset in `01_gateway_clock_offsets.png`.

### Not validated / currently assumed
- ❓ The ~10-min cadence is inferred from timing patterns, not confirmed against firmware documentation.
- ❓ The single-device validation has not been replicated across the broader device population.
- ❓ It is assumed no hub offset exceeds 20 minutes. If the hub population grows or hubs are rebooted, this should be re-checked.
- ❓ `aggfunc="last"` correctness depends on upstream sort order — sort-by-timestamp is load-bearing in `preprocessor.py` and must be explicitly verified before trusting real-data deduplication.

### Known open gotchas
- `WINDOW_TOLERANCE_MINUTES = 2` is defined in `config.py` but unused in `wrangler.py` — it is a stub of a tolerance idea that has not been implemented.
- The synthetic generator assigns all hubs the *same* timestamp at each step, baking in the 20-min assumption it is supposed to help calibrate. It cannot test any of the alternatives below until extended.

---

## 3. Supervisor Feedback Summary

The supervisor raised the following concerns and suggestions:

1. **20-minute window is too naive** — explore alternatives and provide concrete statistical justification.
2. **Assume slow movement** with heavy movement filtering rather than trusting the window to handle it implicitly.
3. **Add a trust/confidence factor** that degrades as a device moves and recovers as it stabilizes.
4. **Concrete analysis required:** time delta/offset spread validation and visualization, with statistical backing.
5. **Alternative approach offered:** manually floor to a 10-minute window but pair it with confidence-level filtering (hub count, elapsed time in window, etc.) to compensate for incomplete vectors.

---

## 4. Analysis Agenda: Four Research Threads

Each thread is independent and can be executed in any order, but Thread 1 is the foundation that informs the others.

---

### Thread 1 — Characterize the timing structure (population-wide)

**Goal:** Establish rigorous, population-level empirical evidence for the clock-offset structure. Currently the only evidence is one device over 4 hours.

**Important:** All analysis must use `reported_scan_timestamp`, *not* `timestamp`. Using the ingestion column washes out the offset structure completely.

#### 1a. Cadence confirmation
- Per gateway, compute consecutive `reported_scan_timestamp` gaps.
- Histogram inter-arrival times across the hub population.
- **Key question:** Is the cadence *exactly* 10.000 min, or is there drift/jitter?
  - Fixed cadence → fixed phase offset → 20-min window is stable indefinitely.
  - Drifting cadence → offsets change over time → 20-min window may eventually fail.

#### 1b. Phase stability over time
- Plot `timestamp mod 10min` vs. time-of-day for a sample of hubs.
- A horizontal band = fixed offset + stable cadence (confirms the assumption).
- A sloped band = phase drift (breaks the assumption, changes the analysis entirely).

#### 1c. Offset distribution across the full hub population
- Compute the modal phase (circular mean of `ts mod 10min`) for every gateway.
- Plot as a histogram/strip plot.
- **Key question:** Is the distribution approximately uniform over [0, 10 min)?
  - Uniform → spread approaches one full cadence structurally → `2 × cadence` justification is rock solid.
  - Clustered → some hubs have similar offsets → the effective spread is smaller than feared and a narrower window may work.
- Check the population-level maximum offset: does any hub offset approach or exceed 10 min?

**Deliverable:** Three plots (cadence histogram, phase-vs-time, offset population strip/histogram) + a table of summary statistics (median/p95/p99/max offset spread across hub pairs).

---

### Thread 2 — Window-width sweep (the quantitative tradeoff)

**Goal:** Replace the current single-anecdote justification with a curve that shows the tradeoff between coverage and coherence across multiple window widths.

#### Setup
For `W ∈ {5, 10, 15, 20, 30, 40}` minutes, bucket the data using `floor_timestamp(W)` and compute:

#### 2a. Coverage curve (argues for wider windows)
- Count of usable (≥2-hub) RSSI vectors.
- Mean and median hub count per vector.
- Fraction of device-windows with ≥3, ≥4, ≥5 hubs.

#### 2b. Double-report / merging curve (argues against wider windows)
- Count `(device, window, gateway)` triples where a hub appears ≥2× before `aggfunc` collapses it.
- Express as a fraction of all device-window-hub triples.
- This is the **quantitative form of the `aggfunc="last"` risk** — a hub reporting twice in one bucket and getting silently reduced to one reading.

#### 2c. Within-window temporal spread
- For each window, compute the spread (max_ts − min_ts) across hub reports that land in it.
- Plot as a distribution per window width.
- This is the **coherence cost**: how much temporal blur the window introduces.

**Deliverable:** A three-panel plot — coverage curve, merging rate curve, temporal spread distribution — all vs. window width. The **crossing region** of coverage and merging curves is the defensible window band.

---

### Thread 3 — Smarter grouping alternatives (beyond the fixed floor)

**Goal:** Explore whether the coverage/coherence tension can be dissolved rather than traded off, using methods that respect the underlying timing structure instead of overriding it.

#### 3a. De-skewing (clock correction)
- **Idea:** Estimate each hub's phase offset from Thread 1a, subtract it from every timestamp, then bucket on a fine grid (e.g., 10 or even 5 min).
- **Hypothesis:** If offsets are stable, de-skewed 10-min windows achieve the same hub-capture rate as raw 20-min windows, with half the temporal blur.
- **Implementation:** Per-hub offset = circular mean of `ts mod 10min` across all observations. Corrected timestamp = `ts − offset`. Then apply a standard floor.
- **Validation:** Compare hub-capture rates before and after correction at W=10, W=15, W=20.

#### 3b. Gap-based sessionization
- **Idea:** Per device, sort reports and split wherever the inter-arrival gap exceeds a threshold τ, derived from the gap distribution itself.
- **Expected gap histogram:** bimodal — small gaps (within-cycle, between different hubs) and ~10-min gaps (between-cycle, same hub's next report). The valley between the two modes *is* τ.
- **Advantage:** No fixed-grid boundary artifacts at all. Even 20-min windows occasionally split a cluster that straddles a :00/:20 boundary.
- **Note:** `WINDOW_TOLERANCE_MINUTES = 2` in `config.py` is a partially-formed version of this idea — it just hasn't been implemented.

**Deliverable:** Prototype of de-skewed bucketing applied to the same data as Thread 2, with side-by-side coverage and coherence metrics vs. the raw floor approach.

---

### Thread 4 — Movement filtering & confidence scoring

**Goal:** Implement the supervisor's suggestion of a trust/confidence factor tied to device stability and observation quality.

#### 4a. Resolution constraint to understand first
Each hub reports ~once per 10-min cycle, so **intra-window movement is essentially unobservable** — you have ~one snapshot per hub per window. Movement shows up *across* consecutive windows as a changing RSSI vector. Confidence is therefore a function of cross-window behavior, not intra-window behavior.

#### 4b. Components of a confidence score
Three observable quantities that each contribute independently:

| Component | High Confidence | Low Confidence |
|---|---|---|
| **Hub count** | Many hubs in window | Few hubs (≤2) |
| **Within-window temporal spread** | Reports are tightly clustered | Reports span nearly the full window |
| **Cross-window vector stability** | RSSI vector similar to previous window | Vector changed significantly |

A composite score (e.g., weighted product or min of normalized components) produces a per-window confidence value in [0, 1].

#### 4c. Where confidence lives architecturally
Three possible locations — decide before implementing:
- **Pre-filter (at wrangling):** Drop low-confidence windows before they reach clustering. Simple but discards data.
- **Soft weight (at clustering):** Pass confidence as a sample weight to GMM or k-means. Preserves data, down-weights noisy windows.
- **HMM transition prior (at smoothing):** High movement (low confidence) → increase transition probability in the HMM. Most principled: slow-movement prior is already the natural job of the Stage-2 HMM.

**Deliverable:** A scored DataFrame with a `confidence` column added; a plot of confidence distribution vs. time of day and vs. hub count; a threshold sensitivity analysis.

---

## 5. Synthetic Testbed Extension (Enabling Thread)

The current `generator.py` assigns all hubs identical timestamps and steps at 20-min resolution. This means it **cannot test any of the alternatives above** and bakes in the very assumption being questioned.

### Proposed extensions
1. **Fine-resolution trajectory:** Step at 30–60 seconds instead of 20 minutes, recording true device position at each step.
2. **Per-hub offset simulation:** Give each hub a fixed boot-offset drawn from a uniform distribution over [0, 10 min), and sample the trajectory at `boot_offset + n × cadence_minutes`.
3. **Optional cadence jitter:** Add small Gaussian noise to the cadence to test drift scenarios.

### Why this matters
With ground-truth positions and known offsets, the testbed lets you:
- Verify that de-skewing (Thread 3a) recovers the correct offsets.
- Measure exactly how much position is smeared by each window width.
- Confirm that the movement/confidence detector (Thread 4) fires correctly before testing on real data.

This turns the notebook from "here's what the data looks like" into "here's a validated method applied to real data" — a much stronger deliverable.

---

## 6. Notebook Structure (End-of-Day Deliverable)

Suggested structure for `04_windowing_reassessment.ipynb`:

```
§0  Setup & Credentials
§1  Timing Structure Characterization          ← Thread 1 (foundation)
    1.1  Per-hub inter-arrival cadence
    1.2  Phase stability over time
    1.3  Offset distribution across hub population
§2  Window-Width Sweep                         ← Thread 2 (the tradeoff)
    2.1  Coverage curve
    2.2  Double-report / merging curve
    2.3  Within-window temporal spread
    2.4  Combined tradeoff plot
§3  Alternative Grouping Strategies            ← Thread 3 (if time allows)
    3.1  De-skewed bucketing prototype
    3.2  Gap-based sessionization sketch
§4  Confidence Scoring                         ← Thread 4 (if time allows)
    4.1  Score components
    4.2  Distribution analysis
    4.3  Threshold sensitivity
§5  Findings & Recommendations
    5.1  Summary table: all methods side-by-side
    5.2  Recommended next step
    5.3  Open questions remaining
```

Threads 1 and 2 constitute the minimum viable deliverable. Threads 3 and 4 are stretch goals and natural "next session" material.

---

## 7. Critical Implementation Notes

- **Always use `reported_scan_timestamp`**, not `timestamp`. The ingestion column washes out all offset structure.
- Thread 1 requires **no `floor_timestamp()`** — all computation is raw modular arithmetic on timestamps. You are not blocked.
- Thread 2 requires `floor_timestamp()` to be working before the sweep can run.
- Confirm sort-by-timestamp is enforced upstream before trusting any `aggfunc="last"` results on real data.
- Exclude `bio_id_test_scan_results` in all queries.
- Clear notebook outputs before committing (real device/patient identifiers in query results).

---

## 8. Open Questions (Parking Lot)

These are not answered by the above threads but should be tracked:

- [ ] What is the actual firmware-confirmed hub cadence? (Currently inferred, not confirmed.)
- [ ] What is the maximum patient/device movement speed that matters for the use case? (Determines whether 20-min position smearing is acceptable in practice.)
- [ ] If cadence drifts, how long until the 20-min window breaks? What is the time horizon for a recalibration check?
- [ ] How does hub count per window vary across times of day and floors/wings of the hospital? (The single-device validation may not be representative of spatial variation.)
- [ ] Should confidence scoring live in the aggregation step, as a clustering weight, or in the HMM? (Architectural decision needed before implementation.)
- [ ] Does `WINDOW_TOLERANCE_MINUTES` get promoted to a real tolerance parameter, or does de-skewing make it unnecessary?
