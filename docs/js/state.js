// state.js — shared constants and the single STATE object read/written by all modules

const GRID_PX  = 35;   // dot-grid spacing in pixels
const HUB_HS   = 14;   // hub icon half-size → 28×28 bounding box
const DEV_R    = 12;   // device circle radius
const HIT_HUB  = 20;  // click-hit radius for hubs
const HIT_DEV  = 17;  // click-hit radius for devices
const HIT_WALL = 7;   // perpendicular-distance threshold for walls
const KB_H     = 22;  // key hints bar height (px)

// Colour palette
const C_BG     = '#0a0f1a';
const C_GRID   = 'rgba(24, 50, 86, 0.70)';
const C_HUB    = '#0ec8d8';
const C_HUB_BG = '#030d18';
const C_DEV    = '#f59e0b';
const C_DEV_BG = '#0b0800';
const C_WALL   = 'rgba(172, 204, 228, 0.72)';
const C_RED    = '#ef4444';

const STATE = {
  // Interaction mode
  mode: 'add-hub',  // 'add-hub' | 'add-device' | 'add-wall' | 'select' | 'delete'

  // Placed elements
  hubs:    [],  // [{x, y, label}]
  devices: [],  // [{x, y, label}]
  walls:   [],  // [{x1, y1, x2, y2}]

  // User-controlled settings
  radius:    150,
  showRings: true,

  // Auto-increment counters (never decremented; labels stay unique after deletion)
  hubCount: 0,
  devCount: 0,

  // Active drag: null or {type:'hub'|'device', idx, ox, oy}
  drag: null,

  // Wall currently being drawn: null or {x, y} of start point
  wallStart: null,

  // Selected element (used in select mode): null or {type, idx}
  selected: null,

  // Whether the current pointer-down has moved ≥ threshold (distinguishes click vs drag)
  hasDragged:  false,
  mouseDownAt: null,  // {x, y}

  // Hover indices for delete-mode red highlight (-1 = none)
  hoverHub:  -1,
  hoverDev:  -1,
  hoverWall: -1,

  // Current mouse position in canvas coordinates
  mouse: { x: 0, y: 0 },

  // Zone classification result (computed on demand)
  zoneGrid:      null,   // [{x, y, hubIdx}] or null
  zonesComputed: false,

  // Connection line currently hovered (for RSSI tooltip)
  hoverConnection: null, // {devIdx, hubIdx} or null
};
