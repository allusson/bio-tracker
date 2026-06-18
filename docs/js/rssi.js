// rssi.js — signal strength math: pure functions only, no DOM interaction

const PIXELS_PER_METER    = 20;  // scale: 20 px = 1 m
const PATH_LOSS_EXP       = 2.7; // log-distance path loss exponent
const RSSI_AT_1M          = -45; // dBm at 1 m reference distance
const WALL_ATTENUATION_DB = 12;  // dBm penalty per intersecting wall

// Returns a [0, 1] strength value if dev and hub are within STATE.radius, or null if out of range.
function connectionStrength(dev, hub) {
  const dist = Math.hypot(dev.x - hub.x, dev.y - hub.y);
  if (dist > STATE.radius) return null;
  return 1 - dist / STATE.radius;
}

// Parametric segment-segment intersection. Returns t along AB, or null if no intersection.
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denom) < 1e-10) return null; // parallel / collinear
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
  return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? t : null;
}

// True if wall segment crosses the line from (x1,y1) to (x2,y2).
function wallIntersectsLine(wall, x1, y1, x2, y2) {
  return segmentsIntersect(x1, y1, x2, y2, wall.x1, wall.y1, wall.x2, wall.y2) !== null;
}

// Returns the crossing points (sorted dev→hub) where walls cross the dev-hub line.
function getWallCrossings(dev, hub) {
  const crossings = [];
  for (const wall of STATE.walls) {
    const t = segmentsIntersect(dev.x, dev.y, hub.x, hub.y, wall.x1, wall.y1, wall.x2, wall.y2);
    if (t !== null) {
      crossings.push({
        x: dev.x + t * (hub.x - dev.x),
        y: dev.y + t * (hub.y - dev.y),
        t,
      });
    }
  }
  crossings.sort((a, b) => a.t - b.t);
  return crossings;
}

// Log-distance path loss RSSI + wall attenuation.
// Returns { freeSpace: number, attenuated: number, wallCount: number } (all dBm, rounded).
function computeRSSI(dev, hub) {
  const dist       = Math.hypot(dev.x - hub.x, dev.y - hub.y);
  const distMeters = Math.max(dist, 1) / PIXELS_PER_METER;
  const freeSpace  = RSSI_AT_1M - 10 * PATH_LOSS_EXP * Math.log10(distMeters);

  let wallCount = 0;
  for (const wall of STATE.walls) {
    if (wallIntersectsLine(wall, dev.x, dev.y, hub.x, hub.y)) wallCount++;
  }

  return {
    freeSpace:  Math.round(freeSpace),
    attenuated: Math.round(freeSpace - wallCount * WALL_ATTENUATION_DB),
    wallCount,
  };
}
