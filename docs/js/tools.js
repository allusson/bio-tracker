// tools.js — mouse and keyboard interaction: placement, dragging, deletion, wall drawing

const HIT_CONNECTION = 8; // px threshold for connection line hover

let connectionTooltipActive = false;

// Check if (x, y) is hovering a visible connection line and update the RSSI tooltip.
function checkConnectionHover(x, y) {
  let found = null;
  outer: for (let di = 0; di < STATE.devices.length; di++) {
    const dev = STATE.devices[di];
    for (let hi = 0; hi < STATE.hubs.length; hi++) {
      if (connectionStrength(dev, STATE.hubs[hi]) === null) continue;
      if (ptSegDist(x, y, dev.x, dev.y, STATE.hubs[hi].x, STATE.hubs[hi].y) < HIT_CONNECTION) {
        found = { devIdx: di, hubIdx: hi };
        break outer;
      }
    }
  }

  STATE.hoverConnection = found;

  if (found) {
    connectionTooltipActive = true;
    showConnectionTooltip(found.devIdx, found.hubIdx, x, y);
  } else if (connectionTooltipActive) {
    connectionTooltipActive = false;
    hideTooltip();
  }
}

// Use window for mousemove/mouseup so drags aren't cancelled when leaving canvas
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  e.preventDefault();
  const pos = canvasPos(e);
  STATE.mouseDownAt = pos;
  STATE.hasDragged  = false;

  switch (STATE.mode) {

    case 'add-hub': {
      const label = hubLabel(STATE.hubCount++);
      STATE.hubs.push({ x: pos.x, y: pos.y, label });
      STATE.selected = { type: 'hub', idx: STATE.hubs.length - 1 };
      invalidateZones();
      hideTooltip();
      break;
    }

    case 'add-device': {
      const label = 'Device ' + (++STATE.devCount);
      STATE.devices.push({ x: pos.x, y: pos.y, label });
      STATE.selected = { type: 'device', idx: STATE.devices.length - 1 };
      hideTooltip();
      break;
    }

    case 'add-wall': {
      STATE.wallStart = { x: pos.x, y: pos.y };
      break;
    }

    case 'select': {
      const hi = hitHub(pos.x, pos.y);
      const di = hi < 0 ? hitDev(pos.x, pos.y) : -1;

      if (hi >= 0) {
        STATE.drag     = { type: 'hub', idx: hi, ox: pos.x - STATE.hubs[hi].x, oy: pos.y - STATE.hubs[hi].y };
        STATE.selected = { type: 'hub', idx: hi };
        invalidateZones();
        hideTooltip();
      } else if (di >= 0) {
        STATE.drag     = { type: 'device', idx: di, ox: pos.x - STATE.devices[di].x, oy: pos.y - STATE.devices[di].y };
        STATE.selected = { type: 'device', idx: di };
        hideTooltip();
      } else {
        STATE.selected = null;
        hideTooltip();
      }
      break;
    }

    case 'delete': {
      const hi = hitHub(pos.x, pos.y);
      if (hi >= 0) { STATE.hubs.splice(hi, 1); STATE.selected = null; invalidateZones(); hideTooltip(); return; }
      const di = hitDev(pos.x, pos.y);
      if (di >= 0) { STATE.devices.splice(di, 1); STATE.selected = null; hideTooltip(); return; }
      const wi = hitWall(pos.x, pos.y);
      if (wi >= 0) { STATE.walls.splice(wi, 1); return; }
      break;
    }
  }
});

window.addEventListener('mousemove', e => {
  const pos = canvasPos(e);
  STATE.mouse = pos;

  if (STATE.drag) {
    STATE.hasDragged = true;
    const { type, idx, ox, oy } = STATE.drag;
    if (type === 'hub') {
      STATE.hubs[idx].x = pos.x - ox;
      STATE.hubs[idx].y = pos.y - oy;
      invalidateZones();
    }
    if (type === 'device') { STATE.devices[idx].x = pos.x - ox; STATE.devices[idx].y = pos.y - oy; }
    updateTooltip();
  }

  const inCanvas = pos.x >= 0 && pos.x <= canvas.width &&
                   pos.y >= 0 && pos.y <= canvas.height;
  if (inCanvas) {
    refreshHover(pos.x, pos.y);
    checkConnectionHover(pos.x, pos.y);
  }
});

window.addEventListener('mouseup', e => {
  if (e.button !== 0) return;
  const pos = canvasPos(e);

  if (STATE.mode === 'add-wall' && STATE.wallStart) {
    const dx = pos.x - STATE.wallStart.x, dy = pos.y - STATE.wallStart.y;
    if (dx * dx + dy * dy > 64) {  // minimum ~8 px
      STATE.walls.push({ x1: STATE.wallStart.x, y1: STATE.wallStart.y, x2: pos.x, y2: pos.y });
    }
    STATE.wallStart = null;
  }

  // Click (no meaningful drag) in select mode → show tooltip
  if (STATE.mode === 'select' && !STATE.hasDragged && STATE.selected) {
    showTooltip(STATE.selected.type, STATE.selected.idx);
  }

  STATE.drag = null;
  refreshHover(pos.x, pos.y);
});

// Right-click: cancel in-progress wall, or deselect
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (STATE.wallStart)  { STATE.wallStart = null; return; }
  if (STATE.drag)       { STATE.drag = null; return; }
  if (STATE.selected)   { STATE.selected = null; hideTooltip(); }
});

// Clear delete hover and connection tooltip when pointer leaves canvas
canvas.addEventListener('mouseleave', () => {
  STATE.hoverHub = STATE.hoverDev = STATE.hoverWall = -1;
  STATE.hoverConnection = null;
  if (connectionTooltipActive) { connectionTooltipActive = false; hideTooltip(); }
});

window.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  switch (e.key) {
    case 'h': case 'H': setMode('add-hub');    break;
    case 'd': case 'D': setMode('add-device'); break;
    case 'w': case 'W': setMode('add-wall');   break;
    case 's': case 'S': setMode('select');     break;
    case 'x': case 'X': setMode('delete');     break;

    case 'Escape':
      if (STATE.wallStart) { STATE.wallStart = null; break; }
      if (STATE.drag)      { STATE.drag = null; break; }
      STATE.selected = null; hideTooltip();
      break;

    case 'Delete':
    case 'Backspace':
      if (STATE.selected) {
        if (STATE.selected.type === 'hub')    { STATE.hubs.splice(STATE.selected.idx, 1); invalidateZones(); }
        if (STATE.selected.type === 'device') STATE.devices.splice(STATE.selected.idx, 1);
        STATE.selected = null; STATE.drag = null; hideTooltip();
        e.preventDefault();
      }
      break;
  }
});
