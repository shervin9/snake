/**
 * Server-side game engine with FILE-BASED state persistence.
 * Works reliably in both development and production modes.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

export type Segment = { x: number; y: number };
export type Food = { id: string; x: number; y: number; monitorId: string };
export type Direction = "up" | "down" | "left" | "right";
export type Phase = "idle" | "running" | "ended";

export type ServerGameState = {
  phase: Phase;
  score: number;
  dir: Direction;
  nextDir: Direction;
  snake: Segment[];
  foods: Food[];
  activeMonitorId: string;
  tick: number;
  lastTickTime: number;
  timeLeftMs: number;
  totalTimeMs: number;
};

export type GameConfig = {
  monitorCount: number;
  timerSeconds: number;
  foodPerMonitor: number;
  gridCellSize: number;
  tickIntervalMs: number;
};

export type MonitorConfig = {
  id: string;
  row: number;
  col: number;
  rotationDeg?: number;
};

export type Portal = {
  from: string;
  to: string;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
};

// ============================================================================
// Constants
// ============================================================================

const MONITOR_W = 1920;
const MONITOR_H = 1080;
const DEFAULT_CELL = 30;
const DEFAULT_TICK_INTERVAL = 100;
const PORTAL_RADIUS = 80;

// State file path
const STATE_FILE = path.join(process.cwd(), '.snake-state.json');

// ============================================================================
// File-based State Management
// ============================================================================

interface FullState {
  config: GameConfig;
  monitors: MonitorConfig[];
  portals: Portal[];
  game: ServerGameState;
}

function getDefaultConfig(): GameConfig {
  return {
    monitorCount: 6,
    timerSeconds: 120,
    foodPerMonitor: 5,
    gridCellSize: DEFAULT_CELL,
    tickIntervalMs: DEFAULT_TICK_INTERVAL,
  };
}

function getDefaultGameState(config: GameConfig): ServerGameState {
  const startX = MONITOR_W / 2;
  const startY = MONITOR_H / 2;
  const cell = config.gridCellSize;
  
  return {
    phase: "idle",
    score: 0,
    dir: "right",
    nextDir: "right",
    snake: [
      snapToGrid(startX, startY, cell),
      snapToGrid(startX - cell, startY, cell),
    ],
    foods: [],
    activeMonitorId: "0",
    tick: 0,
    lastTickTime: Date.now(),
    timeLeftMs: config.timerSeconds * 1000,
    totalTimeMs: config.timerSeconds * 1000,
  };
}

function generateMonitors(count: number): MonitorConfig[] {
  const monitors: MonitorConfig[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    monitors.push({
      id: String(i),
      row: Math.floor(i / cols),
      col: i % cols,
    });
  }
  return monitors;
}

function generatePortals(monitors: MonitorConfig[]): Portal[] {
  const portals: Portal[] = [];
  for (let i = 0; i < monitors.length; i++) {
    const next = (i + 1) % monitors.length;
    portals.push({
      from: monitors[i].id,
      to: monitors[next].id,
      fromPos: { x: MONITOR_W - 80, y: MONITOR_H / 2 },
      toPos: { x: 100, y: MONITOR_H / 2 },
    });
  }
  return portals;
}

function loadState(): FullState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const state = JSON.parse(data) as FullState;
      // Update lastTickTime to now to prevent time jumps
      state.game.lastTickTime = Date.now();
      return state;
    }
  } catch (err) {
    console.error('[Snake] Error loading state:', err);
  }
  
  // Return default state
  const config = getDefaultConfig();
  const monitors = generateMonitors(config.monitorCount);
  const portals = generatePortals(monitors);
  const game = getDefaultGameState(config);
  
  return { config, monitors, portals, game };
}

function saveState(state: FullState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8');
  } catch (err) {
    console.error('[Snake] Error saving state:', err);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function snapToGrid(x: number, y: number, cell: number): { x: number; y: number } {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  return { x: gx * cell + cell / 2, y: gy * cell + cell / 2 };
}

function monitorOrigin(monitors: MonitorConfig[], id: string): { x: number; y: number } {
  const m = monitors.find((mm) => mm.id === id) ?? monitors[0];
  return m ? { x: m.col * MONITOR_W, y: m.row * MONITOR_H } : { x: 0, y: 0 };
}

function findMonitor(monitors: MonitorConfig[], pos: { x: number; y: number }): MonitorConfig | undefined {
  return monitors.find((m) => {
    const ox = m.col * MONITOR_W;
    const oy = m.row * MONITOR_H;
    return pos.x >= ox && pos.x < ox + MONITOR_W && pos.y >= oy && pos.y < oy + MONITOR_H;
  });
}

// ============================================================================
// Food Generation
// ============================================================================

function spawnFoods(state: FullState): void {
  state.game.foods = [];
  
  for (const m of state.monitors) {
    const ox = m.col * MONITOR_W;
    const oy = m.row * MONITOR_H;
    
    for (let i = 0; i < state.config.foodPerMonitor; i++) {
      const x = ox + 100 + Math.random() * (MONITOR_W - 200);
      const y = oy + 100 + Math.random() * (MONITOR_H - 200);
      const pos = snapToGrid(x, y, state.config.gridCellSize);
      
      state.game.foods.push({
        id: makeId(),
        x: pos.x,
        y: pos.y,
        monitorId: m.id,
      });
    }
  }
}

function respawnFood(state: FullState, monitorId: string): void {
  const m = state.monitors.find((mm) => mm.id === monitorId);
  if (!m) return;
  
  const ox = m.col * MONITOR_W;
  const oy = m.row * MONITOR_H;
  const x = ox + 100 + Math.random() * (MONITOR_W - 200);
  const y = oy + 100 + Math.random() * (MONITOR_H - 200);
  const pos = snapToGrid(x, y, state.config.gridCellSize);
  
  state.game.foods.push({
    id: makeId(),
    x: pos.x,
    y: pos.y,
    monitorId,
  });
}

// ============================================================================
// Game Logic
// ============================================================================

function step(state: FullState): void {
  const game = state.game;
  if (game.phase !== "running") return;
  
  const cell = state.config.gridCellSize;
  const head = game.snake[0];
  
  // Calculate new head position
  const dx = game.dir === "left" ? -cell : game.dir === "right" ? cell : 0;
  const dy = game.dir === "up" ? -cell : game.dir === "down" ? cell : 0;
  let newHead = { x: head.x + dx, y: head.y + dy };
  
  // Find current monitor
  const currentMon = findMonitor(state.monitors, head);
  if (!currentMon) {
    // Reset to center if lost
    newHead = snapToGrid(MONITOR_W / 2, MONITOR_H / 2, cell);
  } else {
    const ox = currentMon.col * MONITOR_W;
    const oy = currentMon.row * MONITOR_H;
    const localX = newHead.x - ox;
    const localY = newHead.y - oy;
    
    // Check for portal
    let throughPortal = false;
    for (const p of state.portals) {
      if (p.from === currentMon.id) {
        const dist = Math.hypot(localX - p.fromPos.x, localY - p.fromPos.y);
        if (dist < PORTAL_RADIUS) {
          const toOrigin = monitorOrigin(state.monitors, p.to);
          newHead = snapToGrid(toOrigin.x + p.toPos.x, toOrigin.y + p.toPos.y, cell);
          game.activeMonitorId = p.to;
          throughPortal = true;
          break;
        }
      }
    }
    
    // Check wall collision (only if not through portal)
    if (!throughPortal) {
      if (localX < cell || localX > MONITOR_W - cell || localY < cell || localY > MONITOR_H - cell) {
        game.phase = "ended";
        return;
      }
    }
  }
  
  // Move snake
  game.snake.unshift(newHead);
  
  // Check food collision
  const cell2 = cell * cell;
  let ate = false;
  for (let i = game.foods.length - 1; i >= 0; i--) {
    const f = game.foods[i];
    const dist2 = (newHead.x - f.x) ** 2 + (newHead.y - f.y) ** 2;
    if (dist2 < cell2) {
      game.foods.splice(i, 1);
      game.score += 10;
      respawnFood(state, f.monitorId);
      ate = true;
      break;
    }
  }
  
  if (!ate) {
    game.snake.pop();
  }
  
  // Check self collision (skip first 3 segments)
  for (let i = 3; i < game.snake.length; i++) {
    const seg = game.snake[i];
    if (Math.abs(newHead.x - seg.x) < cell / 2 && Math.abs(newHead.y - seg.y) < cell / 2) {
      game.phase = "ended";
      return;
    }
  }
  
  // Apply buffered direction
  game.dir = game.nextDir;
  game.tick++;
  
  // Update timer
  const now = Date.now();
  game.timeLeftMs -= now - game.lastTickTime;
  game.lastTickTime = now;
  
  if (game.timeLeftMs <= 0) {
    game.phase = "ended";
  }
}

function processTicks(state: FullState): void {
  if (state.game.phase !== "running") return;
  
  const now = Date.now();
  const elapsed = now - state.game.lastTickTime;
  const ticks = Math.floor(elapsed / state.config.tickIntervalMs);
  
  if (ticks > 0) {
    const maxTicks = Math.min(ticks, 5);
    for (let i = 0; i < maxTicks; i++) {
      step(state);
      if (state.game.phase !== "running") break;
    }
    state.game.lastTickTime = now;
  }
}

// ============================================================================
// Public API
// ============================================================================

export function startGame(): ServerGameState {
  const state = loadState();
  
  if (state.game.phase === "running") {
    return { ...state.game };
  }
  
  const cell = state.config.gridCellSize;
  const startX = MONITOR_W / 2;
  const startY = MONITOR_H / 2;
  
  state.game.phase = "running";
  state.game.score = 0;
  state.game.dir = "right";
  state.game.nextDir = "right";
  state.game.snake = [
    snapToGrid(startX, startY, cell),
    snapToGrid(startX - cell, startY, cell),
  ];
  state.game.activeMonitorId = "0";
  state.game.tick = 0;
  state.game.lastTickTime = Date.now();
  state.game.timeLeftMs = state.config.timerSeconds * 1000;
  state.game.totalTimeMs = state.config.timerSeconds * 1000;
  
  spawnFoods(state);
  saveState(state);
  
  console.log(`[Snake] Game started! Foods: ${state.game.foods.length}`);
  return { ...state.game };
}

export function stopGameAction(): ServerGameState {
  const state = loadState();
  state.game.phase = "ended";
  saveState(state);
  return { ...state.game };
}

export function resetGame(): ServerGameState {
  const state = loadState();
  
  const cell = state.config.gridCellSize;
  const startX = MONITOR_W / 2;
  const startY = MONITOR_H / 2;
  
  state.game.phase = "idle";
  state.game.score = 0;
  state.game.dir = "right";
  state.game.nextDir = "right";
  state.game.snake = [
    snapToGrid(startX, startY, cell),
    snapToGrid(startX - cell, startY, cell),
  ];
  state.game.foods = [];
  state.game.activeMonitorId = "0";
  state.game.tick = 0;
  state.game.lastTickTime = Date.now();
  state.game.timeLeftMs = state.config.timerSeconds * 1000;
  state.game.totalTimeMs = state.config.timerSeconds * 1000;
  
  saveState(state);
  return { ...state.game };
}

export function setDirection(dir: Direction): ServerGameState {
  const state = loadState();
  
  const opposite: Record<Direction, Direction> = {
    up: "down", down: "up", left: "right", right: "left"
  };
  
  if (opposite[dir] !== state.game.dir) {
    state.game.nextDir = dir;
    saveState(state);
  }
  
  return { ...state.game };
}

export function getGameState(): ServerGameState {
  const state = loadState();
  processTicks(state);
  saveState(state);
  return { ...state.game };
}

export function getMonitorsConfig(): MonitorConfig[] {
  const state = loadState();
  return [...state.monitors];
}

export function getPortalsConfig(): Portal[] {
  const state = loadState();
  return [...state.portals];
}

export function getGameConfig(): GameConfig {
  const state = loadState();
  return { ...state.config };
}

export function updateConfig(newConfig: Partial<GameConfig>): void {
  const state = loadState();
  Object.assign(state.config, newConfig);
  saveState(state);
}

export function setupGame(
  monitorCount: number,
  timerSeconds: number,
  foodPerMonitor: number = 5
): { monitors: MonitorConfig[]; portals: Portal[] } {
  const config = getDefaultConfig();
  config.monitorCount = monitorCount;
  config.timerSeconds = timerSeconds;
  config.foodPerMonitor = foodPerMonitor;
  
  const monitors = generateMonitors(monitorCount);
  const portals = generatePortals(monitors);
  const game = getDefaultGameState(config);
  
  const state: FullState = { config, monitors, portals, game };
  saveState(state);
  
  return { monitors: [...monitors], portals: [...portals] };
}

export function initServerEngine(m: MonitorConfig[], p: Portal[]): void {
  const state = loadState();
  state.monitors = m;
  state.portals = p;
  saveState(state);
}

export const GAME_CONSTANTS = {
  MONITOR_W,
  MONITOR_H,
  DEFAULT_CELL,
  DEFAULT_TICK_INTERVAL,
  PORTAL_DETECTION_RADIUS: PORTAL_RADIUS,
};
