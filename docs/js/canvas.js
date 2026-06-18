// canvas.js — canvas setup, all draw functions, hit detection, and the main render loop

const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d');
const toolbar = document.getElementById('toolbar');

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight - toolbar.offsetHeight - KB_H;
}
window.addEventListener('resize', resize);
resize();

// Convert a MouseEvent to canvas-local {x, y}
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// Generate hub label: 0→'Hub A', 25→'Hub Z', 26→'Hub AA', …
function hubLabel(n) {
  let s = '', i = n;
  do {
    s = String.fromCharCode(65 + i % 26) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return 'Hub ' + s;
}

// Minimum distance from point (px,py) to segment (ax,ay)→(bx,by)
function ptSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Add a rounded-rect path to ctx. Caller must ctx.beginPath() first.
function rrect(x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);    ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);    ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);         ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

// Returns index of topmost hub under (x,y), or -1
function hitHub(x, y) {
  for (let i = STATE.hubs.length - 1; i >= 0; i--)
    if (Math.hypot(x - STATE.hubs[i].x, y - STATE.hubs[i].y) < HIT_HUB) return i;
  return -1;
}

// Returns index of topmost device under (x,y), or -1
function hitDev(x, y) {
  for (let i = STATE.devices.length - 1; i >= 0; i--)
    if (Math.hypot(x - STATE.devices[i].x, y - STATE.devices[i].y) < HIT_DEV) return i;
  return -1;
}

// Returns index of topmost wall within HIT_WALL px of (x,y), or -1
function hitWall(x, y) {
  for (let i = STATE.walls.length - 1; i >= 0; i--) {
    const w = STATE.walls[i];
    if (ptSegDist(x, y, w.x1, w.y1, w.x2, w.y2) < HIT_WALL) return i;
  }
  return -1;
}

function refreshHover(x, y) {
  if (STATE.mode === 'delete') {
    STATE.hoverHub  = hitHub(x, y);
    STATE.hoverDev  = STATE.hoverHub  >= 0 ? -1 : hitDev(x, y);
    STATE.hoverWall = (STATE.hoverHub >= 0 || STATE.hoverDev >= 0) ? -1 : hitWall(x, y);
    const hit = STATE.hoverHub >= 0 || STATE.hoverDev >= 0 || STATE.hoverWall >= 0;
    canvas.style.cursor = hit ? 'pointer' : 'crosshair';
    return;
  }

  STATE.hoverHub = STATE.hoverDev = STATE.hoverWall = -1;

  if (STATE.mode === 'select') {
    if (STATE.drag) { canvas.style.cursor = 'grabbing'; return; }
    canvas.style.cursor = (hitHub(x, y) >= 0 || hitDev(x, y) >= 0) ? 'grab' : 'default';
    return;
  }

  canvas.style.cursor = 'crosshair';
}

// ── Draw functions ─────────────────────────────────────────────────────────

function drawGrid() {
  ctx.fillStyle = C_GRID;
  for (let x = GRID_PX; x < canvas.width;  x += GRID_PX)
  for (let y = GRID_PX; y < canvas.height; y += GRID_PX)
    ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
}

// Smooth radial gradient fill + 4 discrete ring outlines
function drawHubRings(hub) {
  const { x, y } = hub;
  const R = STATE.radius;

  const grd = ctx.createRadialGradient(x, y, R * 0.04, x, y, R);
  grd.addColorStop(0,    'rgba(14, 200, 216, 0.13)');
  grd.addColorStop(0.45, 'rgba(14, 200, 216, 0.06)');
  grd.addColorStop(1,    'rgba(14, 200, 216, 0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();

  const rings = [[0.30, 0.58], [0.55, 0.40], [0.76, 0.24], [1.00, 0.14]];
  ctx.lineWidth = 1;
  for (const [frac, op] of rings) {
    ctx.beginPath();
    ctx.arc(x, y, R * frac, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(14, 200, 216, ${op})`;
    ctx.stroke();
  }
}

// 28×28 rounded square with BLE-style arcs inside + label below
function drawHub(hub, isSel, isDel) {
  const { x, y } = hub;
  const HS  = HUB_HS;
  const col = isDel ? C_RED : C_HUB;

  ctx.shadowColor = col;
  ctx.shadowBlur  = isSel ? 18 : isDel ? 12 : 0;

  ctx.fillStyle = C_HUB_BG;
  ctx.beginPath();
  rrect(x - HS, y - HS, HS * 2, HS * 2, 4);
  ctx.fill();

  ctx.strokeStyle = col;
  ctx.lineWidth   = isSel ? 2.2 : 1.5;
  ctx.stroke();

  ctx.shadowBlur = 0;

  // BLE / wifi arcs inside upper half of box (upward-opening, 210°→330°)
  ctx.lineWidth = 1.5;
  ctx.lineCap   = 'round';
  for (let i = 0; i < 3; i++) {
    const r = 4 + i * 3;
    ctx.beginPath();
    ctx.arc(x, y - 2, r, Math.PI * 1.17, Math.PI * 1.83, false);
    ctx.strokeStyle  = col;
    ctx.globalAlpha  = 0.28 + i * 0.24;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y - 2, 2, 0, Math.PI * 2);
  ctx.fill();

  // Short letter identifier in lower portion of box
  ctx.fillStyle    = col;
  ctx.globalAlpha  = 0.55;
  ctx.font         = 'bold 9px "Courier New", monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(hub.label.slice(4), x, y + 8);
  ctx.globalAlpha = 1;

  ctx.fillStyle    = isDel ? C_RED : isSel ? '#ccf0ff' : 'rgba(14, 200, 216, 0.82)';
  ctx.font         = '11px Inter, -apple-system, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(hub.label, x, y + HS + 5);
}

// Small circle with inner dot + label below
function drawDevice(dev, isSel, isDel) {
  const { x, y } = dev;
  const col = isDel ? C_RED : C_DEV;

  ctx.shadowColor = col;
  ctx.shadowBlur  = isSel ? 18 : isDel ? 12 : 0;

  ctx.fillStyle   = C_DEV_BG;
  ctx.strokeStyle = col;
  ctx.lineWidth   = isSel ? 2.2 : 1.5;
  ctx.beginPath();
  ctx.arc(x, y, DEV_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, isSel ? 5 : 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle    = isDel ? C_RED : isSel ? '#fff0cc' : 'rgba(245, 158, 11, 0.82)';
  ctx.font         = '11px Inter, -apple-system, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(dev.label, x, y + DEV_R + 5);
}

function drawWall(wall, isHov) {
  ctx.lineCap     = 'round';
  ctx.lineWidth   = isHov ? 3.5 : 2.5;
  ctx.strokeStyle = isHov ? C_RED : C_WALL;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(wall.x1, wall.y1);
  ctx.lineTo(wall.x2, wall.y2);
  ctx.stroke();

  // Small end-cap dots for visual handles
  const dotR = isHov ? 4 : 3;
  for (const p of [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }]) {
    ctx.fillStyle = isHov ? C_RED : C_WALL;
    ctx.beginPath();
    ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Ghost dashed line + length readout while dragging in add-wall mode
function drawWallPreview() {
  const { x: x1, y: y1 } = STATE.wallStart;
  const { x: x2, y: y2 } = STATE.mouse;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'rgba(172, 204, 228, 0.35)';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.setLineDash([9, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(172, 204, 228, 0.52)';
  ctx.beginPath();
  ctx.arc(x1, y1, 4, 0, Math.PI * 2);
  ctx.fill();

  const len = Math.round(Math.hypot(x2 - x1, y2 - y1));
  if (len > 10) {
    ctx.fillStyle    = 'rgba(172, 204, 228, 0.45)';
    ctx.font         = '11px Inter, sans-serif';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(len + ' px', x2 + 8, y2 - 4);
  }
}

// RSSI connection lines (device → hub, dashed, opacity by proximity)
function drawConnections() {
  ctx.lineCap = 'round';
  for (const dev of STATE.devices) {
    for (const hub of STATE.hubs) {
      const strength = connectionStrength(dev, hub);
      if (strength === null) continue;

      const alpha = (0.10 + strength * 0.72).toFixed(3);
      const lw    = 0.6  + strength * 2.2;

      ctx.beginPath();
      ctx.moveTo(dev.x, dev.y);
      ctx.lineTo(hub.x, hub.y);
      ctx.strokeStyle = `rgba(14, 200, 216, ${alpha})`;
      ctx.lineWidth   = lw;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// Small labels at each wall/connection crossing: pre-wall RSSI on one side, post-wall on the other
function drawWallAttenIndicators() {
  for (const dev of STATE.devices) {
    for (const hub of STATE.hubs) {
      if (connectionStrength(dev, hub) === null) continue;

      const crossings = getWallCrossings(dev, hub);
      if (crossings.length === 0) continue;

      const { freeSpace } = computeRSSI(dev, hub);

      const dx = hub.x - dev.x, dy = hub.y - dev.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;

      const ux = dx / len, uy = dy / len; // unit along dev→hub
      const nx = -uy,      ny = ux;       // perpendicular (rotated CCW)

      const STEP = 18; // px offset along line from crossing
      const VERT = 9;  // px offset perpendicular to line

      ctx.font         = '8.5px "Courier New", monospace';
      ctx.textBaseline = 'middle';

      crossings.forEach((c, i) => {
        const pre  = freeSpace - i * WALL_ATTENUATION_DB;
        const post = freeSpace - (i + 1) * WALL_ATTENUATION_DB;

        // Dot at crossing
        ctx.fillStyle = 'rgba(172, 204, 228, 0.50)';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Pre-wall label (device side)
        ctx.fillStyle = 'rgba(172, 204, 228, 0.38)';
        ctx.textAlign = 'right';
        ctx.fillText(`${pre}`, c.x - ux * STEP + nx * VERT, c.y - uy * STEP + ny * VERT);

        // Post-wall label (hub side)
        ctx.textAlign = 'left';
        ctx.fillText(`${post}`, c.x + ux * STEP + nx * VERT, c.y + uy * STEP + ny * VERT);
      });
    }
  }
}

function drawHint() {
  const msgs = {
    'add-hub':    'Click anywhere to place a BioHub anchor node',
    'add-device': 'Click anywhere to place a Bio Button device',
    'add-wall':   'Click and drag to draw a wall segment',
    'select':     'Click an element to select it · drag to move',
    'delete':     'Click any element to remove it from the canvas',
  };
  ctx.fillStyle    = 'rgba(14, 200, 216, 0.20)';
  ctx.font         = '15px Inter, -apple-system, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msgs[STATE.mode] || '', canvas.width / 2, canvas.height / 2);
}

function drawModeLabel() {
  const labels = {
    'add-hub':    'ADD HUB',
    'add-device': 'ADD DEVICE',
    'add-wall':   'ADD WALL',
    'select':     'SELECT / MOVE',
    'delete':     'DELETE',
  };
  ctx.fillStyle    = 'rgba(14, 200, 216, 0.26)';
  ctx.font         = '600 9.5px Inter, sans-serif';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(labels[STATE.mode] || '', 12, canvas.height - 8);
}

// ── Main render compositor ─────────────────────────────────────────────────

function render() {
  ctx.fillStyle = C_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();

  renderZones(); // semi-transparent zone fills sit behind everything else

  if (STATE.showRings) for (const h of STATE.hubs) drawHubRings(h);

  for (let i = 0; i < STATE.walls.length; i++) drawWall(STATE.walls[i], i === STATE.hoverWall);

  if (STATE.mode === 'add-wall' && STATE.wallStart) drawWallPreview();

  drawConnections();
  drawWallAttenIndicators();

  for (let i = 0; i < STATE.hubs.length; i++) {
    drawHub(
      STATE.hubs[i],
      STATE.selected?.type === 'hub'    && STATE.selected.idx === i,
      STATE.mode === 'delete'           && i === STATE.hoverHub,
    );
  }

  for (let i = 0; i < STATE.devices.length; i++) {
    drawDevice(
      STATE.devices[i],
      STATE.selected?.type === 'device' && STATE.selected.idx === i,
      STATE.mode === 'delete'           && i === STATE.hoverDev,
    );
  }

  drawModeLabel();
  const isEmpty = !STATE.hubs.length && !STATE.devices.length && !STATE.walls.length && !STATE.wallStart;
  if (isEmpty) drawHint();
}
