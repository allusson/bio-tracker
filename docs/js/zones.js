// zones.js — zone classification: grid sampling, hub assignment, and zone rendering

const ZONE_PALETTE = [
  [14,  200, 216],   // 0: cyan
  [249, 115, 22],    // 1: orange
  [139, 92,  246],   // 2: purple
  [34,  197, 94],    // 3: green
  [239, 68,  68],    // 4: red
  [234, 179, 8],     // 5: amber
  [236, 72,  153],   // 6: pink
  [56,  189, 248],   // 7: sky blue
  [168, 85,  247],   // 8: violet
  [20,  184, 166],   // 9: teal
];

const ZONE_STEP  = 8;   // sample grid spacing in pixels
const ZONE_ALPHA = 0.20; // fill opacity

let zoneOffscreen = null; // pre-rendered offscreen canvas, rebuilt on each compute

// Sample the canvas grid and assign each point to the hub with the best attenuated RSSI.
// Stores result in STATE and builds the offscreen rendering canvas.
function computeZones() {
  if (!STATE.hubs.length) return;

  const w = canvas.width;
  const h = canvas.height;

  zoneOffscreen         = document.createElement('canvas');
  zoneOffscreen.width   = w;
  zoneOffscreen.height  = h;
  const zctx = zoneOffscreen.getContext('2d');

  const grid = [];

  for (let y = 0; y < h; y += ZONE_STEP) {
    for (let x = 0; x < w; x += ZONE_STEP) {
      let bestHub = 0;
      let bestRSSI = -Infinity;

      for (let hi = 0; hi < STATE.hubs.length; hi++) {
        const { attenuated } = computeRSSI({ x, y }, STATE.hubs[hi]);
        if (attenuated > bestRSSI) { bestRSSI = attenuated; bestHub = hi; }
      }

      grid.push({ x, y, hubIdx: bestHub });

      const [r, g, b] = ZONE_PALETTE[bestHub % ZONE_PALETTE.length];
      zctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${ZONE_ALPHA})`;
      zctx.fillRect(x, y, ZONE_STEP, ZONE_STEP);
    }
  }

  STATE.zoneGrid      = grid;
  STATE.zonesComputed = true;
  updateZoneButtons();
}

// Draw the pre-rendered zone image onto the main canvas. Called from canvas.js render().
function renderZones() {
  if (!STATE.zonesComputed || !zoneOffscreen) return;
  ctx.drawImage(zoneOffscreen, 0, 0);
}

// Called when any hub changes position/existence after zones were computed.
function invalidateZones() {
  if (!STATE.zonesComputed) return;
  STATE.zonesComputed = false;
  STATE.zoneGrid      = null;
  zoneOffscreen       = null;
  updateZoneButtons();
}

// Explicit user-initiated clear.
function clearZones() {
  STATE.zonesComputed = false;
  STATE.zoneGrid      = null;
  zoneOffscreen       = null;
  updateZoneButtons();
}
