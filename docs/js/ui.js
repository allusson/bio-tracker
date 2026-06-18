// ui.js — DOM wiring: toolbar buttons, tooltip, slider, checkbox, clear, and render loop start

const ttEl = document.getElementById('tooltip');

function showTooltip(type, idx) {
  const item = type === 'hub' ? STATE.hubs[idx] : STATE.devices[idx];
  if (!item) { hideTooltip(); return; }

  document.getElementById('tt-name').textContent = item.label;
  document.getElementById('tt-xy').innerHTML =
    `x&thinsp;:&thinsp;${Math.round(item.x)}<br>y&thinsp;:&thinsp;${Math.round(item.y)}`;

  const cr = canvas.getBoundingClientRect();
  let tx = item.x + cr.left + 22;
  let ty = item.y + cr.top  - 14;
  if (tx + 175 > window.innerWidth)  tx = item.x + cr.left - 178;
  if (ty + 100 > window.innerHeight) ty = item.y + cr.top  - 98;
  if (ty < 58)                        ty = item.y + cr.top  + 24;

  ttEl.style.left    = tx + 'px';
  ttEl.style.top     = ty + 'px';
  ttEl.style.display = 'block';
}

// Re-sync tooltip position when selected element is being dragged
function updateTooltip() {
  if (ttEl.style.display === 'none' || !STATE.selected) return;
  showTooltip(STATE.selected.type, STATE.selected.idx);
}

function hideTooltip() { ttEl.style.display = 'none'; }

// Show RSSI info tooltip for a hovered connection line.
function showConnectionTooltip(devIdx, hubIdx, mouseX, mouseY) {
  const dev = STATE.devices[devIdx];
  const hub = STATE.hubs[hubIdx];
  if (!dev || !hub) return;

  const rssi = computeRSSI(dev, hub);
  let rssiLine;
  if (rssi.wallCount > 0) {
    const walls = rssi.wallCount === 1 ? '1 wall' : `${rssi.wallCount} walls`;
    rssiLine = `${rssi.freeSpace} → ${rssi.attenuated} dBm (${walls})`;
  } else {
    rssiLine = `${rssi.freeSpace} dBm`;
  }

  document.getElementById('tt-name').textContent = `${dev.label} → ${hub.label}`;
  document.getElementById('tt-xy').textContent = rssiLine;

  const cr = canvas.getBoundingClientRect();
  let tx = mouseX + cr.left + 14;
  let ty = mouseY + cr.top  - 14;
  if (tx + 185 > window.innerWidth)  tx = mouseX + cr.left - 188;
  if (ty + 80  > window.innerHeight) ty = mouseY + cr.top  - 78;
  if (ty < 58)                        ty = mouseY + cr.top  + 14;

  ttEl.style.left    = tx + 'px';
  ttEl.style.top     = ty + 'px';
  ttEl.style.display = 'block';
}

// Show/hide zone buttons to reflect STATE.zonesComputed.
function updateZoneButtons() {
  document.getElementById('clearZonesbtn').style.display =
    STATE.zonesComputed ? 'inline-block' : 'none';
}

function setMode(mode) {
  STATE.mode = mode;
  STATE.wallStart  = null;
  STATE.drag       = null;
  STATE.selected   = null;
  STATE.hoverHub   = STATE.hoverDev = STATE.hoverWall = -1;
  hideTooltip();
  document.querySelectorAll('.mbtn').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === mode)
  );
  refreshHover(STATE.mouse.x, STATE.mouse.y);
}

// Mode buttons
document.querySelectorAll('.mbtn').forEach(btn =>
  btn.addEventListener('click', () => setMode(btn.dataset.mode))
);

// Detection radius slider
const rslider = document.getElementById('rslider');
const rval    = document.getElementById('rval');
rslider.addEventListener('input', () => {
  STATE.radius = parseInt(rslider.value);
  rval.textContent = STATE.radius;
});

// Signal rings toggle
document.getElementById('ringck').addEventListener('change', e => {
  STATE.showRings = e.target.checked;
});

// Clear all elements and reset counters
document.getElementById('clearbtn').addEventListener('click', () => {
  STATE.hubs    = [];
  STATE.devices = [];
  STATE.walls   = [];
  STATE.hubCount = 0;
  STATE.devCount = 0;
  STATE.selected   = null;
  STATE.drag       = null;
  STATE.wallStart  = null;
  STATE.hoverHub   = STATE.hoverDev = STATE.hoverWall = -1;
  clearZones();
  hideTooltip();
});

// Zone buttons
document.getElementById('computeZonesbtn').addEventListener('click', () => {
  computeZones();
});

document.getElementById('clearZonesbtn').addEventListener('click', () => {
  clearZones();
});

// Start render loop (all modules are loaded at this point)
(function loop() { render(); requestAnimationFrame(loop); })();
