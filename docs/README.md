# docs/

A standalone, browser-based **BLE Coverage Sandbox** for interactive visualisation of hub placement and zone coverage. This is not part of the Python pipeline — it is a pure-JavaScript tool that runs directly in a browser with no server required.

Open `docs/index.html` in any modern browser to launch it. No build step, no dependencies, no installation.

---

## Purpose

The sandbox lets you interactively place hubs, devices, and walls on a 2D canvas and immediately see:
- Signal rings radiating from each hub
- Per-hub RSSI values computed for every device
- Zone boundaries (the region best served by each hub, computed on a pixel grid)

It is useful for building intuition about how hub placement affects coverage overlap and zone separation — the same properties that determine RSSI vector quality in the Python pipeline.

---

## Files

### `index.html`

Entry point. Defines the toolbar (mode buttons, radius slider, signal rings toggle, zone compute/clear), the canvas element, a tooltip overlay, and keyboard shortcut hints. Loads all JS modules in dependency order: `state.js → rssi.js → zones.js → canvas.js → tools.js → ui.js`.

### `styles.css`

Visual styling for the toolbar, canvas, and tooltip.

### `js/state.js`

Global application state: `STATE.hubs`, `STATE.devices`, `STATE.walls`, `STATE.radius`, `STATE.zonesComputed`, `STATE.zoneGrid`. All other modules read and write this object.

### `js/rssi.js`

Signal strength math — pure functions, no DOM interaction.

**Constants:**

| Constant | Value | Meaning |
|---|---|---|
| `PIXELS_PER_METER` | `20` | Scale factor: 20 px = 1 m |
| `PATH_LOSS_EXP` | `2.7` | Log-distance path loss exponent |
| `RSSI_AT_1M` | `−45 dBm` | Reference RSSI at 1 m |
| `WALL_ATTENUATION_DB` | `12 dBm` | Signal penalty per intersecting wall |

**Key functions:**

- `computeRSSI(dev, hub)` — returns `{ freeSpace, attenuated, wallCount }`. Free-space RSSI uses the log-distance model:
  ```
  RSSI(d) = RSSI_AT_1M − 10 · PATH_LOSS_EXP · log₁₀(d_metres)
  ```
  Attenuated RSSI subtracts `wallCount × WALL_ATTENUATION_DB` for each wall segment that crosses the dev-hub line.

- `segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)` — parametric segment-segment intersection test. Returns the parameter `t` along AB at the intersection point, or `null` if the segments don't cross. Used to count wall crossings on the dev-hub path.

- `connectionStrength(dev, hub)` — returns a `[0, 1]` value based on pixel distance relative to `STATE.radius`, or `null` if out of range. Used for rendering signal ring opacity.

### `js/zones.js`

Zone classification: samples the canvas on an 8 px grid and assigns each grid point to the hub with the highest attenuated RSSI. Builds an offscreen canvas with semi-transparent colour fills (20% opacity, 10-colour palette) and composites it onto the main canvas.

- `computeZones()` — runs the full grid sampling pass and stores results in `STATE.zoneGrid`. Called when the user clicks "Compute Zones."
- `renderZones()` — draws the pre-rendered offscreen canvas. Called from the main render loop.
- `invalidateZones()` — called whenever a hub moves or is added/removed, clears the cached zone image so the next render shows no zones until recomputed.

### `js/canvas.js`

Main render loop: draws hubs (circles + labels), devices (squares + RSSI readouts), walls (line segments), signal rings, and the zone overlay. Uses `requestAnimationFrame` for smooth updates.

### `js/tools.js`

Mouse event handlers for each editing mode: add-hub, add-device, add-wall, select/move, and delete. Mode is set by the toolbar buttons and keyboard shortcuts (H, D, W, S, X).

### `js/ui.js`

Toolbar wiring: button active states, radius slider, signal rings checkbox, zone button visibility, and keyboard shortcut dispatch.

---

## Path Loss Model (docs vs. Python)

The sandbox and the Python pipeline both use the log-distance path loss model but with different calibration constants:

| Constant | `docs/js/rssi.js` | `synthetic_data/config.py` |
|---|---|---|
| Reference RSSI at 1 m | −45 dBm | −40 dBm (`RSSI_REF`) |
| Path loss exponent | 2.7 | 3.0 (`PATH_LOSS_EXP`) |
| Wall attenuation | 12 dBm/wall | not modelled |

The sandbox constants are tuned for a visually reasonable demo. The Python generator constants are separate design choices that should be calibrated against real data (see `analysis/03_synthetic_vs_real.ipynb`).
