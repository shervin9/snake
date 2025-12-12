/**
 * Server-side game engine with IN-MEMORY state.
 * Uses globalThis for state persistence across requests in production.
 * Config loaded from game.config.json file.
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
  snakeSpeed: number;
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
const PORTAL_RADIUS = 80;
const CONFIG_FILE = path.join(process.cwd(), 'game.config.json');

// ============================================================================
// Global State (persists across requests via globalThis)
// ============================================================================

interface GlobalState {
  config: GameConfig;
  monitors: MonitorConfig[];
  portals: Portal[];
  game: ServerGameState;
  initialized: boolean;
}

// Use globalThis to persist state across API requests
const G = globalThis as typeof globalThis & { __snakeGame?: GlobalState };

function getGlobal(): GlobalState {
  if (!G.__snakeGame) {
    G.__snakeGame = createInitialState();
  }
  return G.__snakeGame;
}

// ============================================================================
// Config Loading
// ============================================================================

interface FileConfig {
  monitorCount?: number;
  timerSeconds?: number;
  foodPerMonitor?: number;
  snakeSpeed?: number;
}

function loadConfigFromFile(): FileConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[Snake] Error loading config:', err);
  }
  return {};
}

function createConfig(fileConfig: FileConfig): GameConfig {
  // snakeSpeed: 1 = slow (200ms), 10 = fast (50ms)
  const speed = Math.max(1, Math.min(10, fileConfig.snakeSpeed ?? 8));
  const tickIntervalMs = 250 - (speed * 20); // speed 1=230ms, speed 10=50ms
  
  return {
    monitorCount: fileConfig.monitorCount ?? 6,
    timerSeconds: fileConfig.timerSeconds ?? 120,
    foodPerMonitor: fileConfig.foodPerMonitor ?? 5,
    gridCellSize: DEFAULT_CELL,
    tickIntervalMs,
    snakeSpeed: speed,
  };
}

// ============================================================================
// Initialization
// ============================================================================

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

function createInitialGameState(config: GameConfig): ServerGameState {
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

function createInitialState(): GlobalState {
  const fileConfig = loadConfigFromFile();
  const config = createConfig(fileConfig);
  const monitors = generateMonitors(config.monitorCount);
  const portals = generatePortals(monitors);
  const game = createInitialGameState(config);
  
  console.log(`[Snake] Initialized: ${config.monitorCount} monitors, speed=${config.snakeSpeed} (${config.tickIntervalMs}ms)`);
  
  return {
    config,
    monitors,
    portals,
    game,
    initialized: true,
  };
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

function spawnFoods(state: GlobalState): void {
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

function respawnFood(state: GlobalState, monitorId: string): void {
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

function step(state: GlobalState): void {
  const game = state.game;
  if (game.phase !== "running") return;
  
  const cell = state.config.gridCellSize;
  const head = game.snake[0];
  
  // Apply direction
  game.dir = game.nextDir;
  
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
        console.log(`[Snake] Wall collision at local (${localX}, ${localY})`);
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
      console.log(`[Snake] Self collision at segment ${i}`);
      game.phase = "ended";
      return;
    }
  }
  
  game.tick++;
}

function processTicks(state: GlobalState): void {
  if (state.game.phase !== "running") return;
  
  const now = Date.now();
  const elapsed = now - state.game.lastTickTime;
  
  // Update timer
  state.game.timeLeftMs -= elapsed;
  if (state.game.timeLeftMs <= 0) {
    state.game.phase = "ended";
    console.log('[Snake] Time up!');
    return;
  }
  
  // Process ticks
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
  const state = getGlobal();
  
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
  
  console.log(`[Snake] Game started! Foods: ${state.game.foods.length}, Speed: ${state.config.snakeSpeed}`);
  return { ...state.game };
}

export function stopGameAction(): ServerGameState {
  const state = getGlobal();
  state.game.phase = "ended";
  return { ...state.game };
}

export function resetGame(): ServerGameState {
  const state = getGlobal();
  
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
  
  console.log('[Snake] Game reset');
  return { ...state.game };
}

export function setDirection(dir: Direction): ServerGameState {
  const state = getGlobal();
  
  if (state.game.phase !== "running") {
    return { ...state.game };
  }
  
  const opposite: Record<Direction, Direction> = {
    up: "down", down: "up", left: "right", right: "left"
  };
  
  if (opposite[dir] !== state.game.dir) {
    state.game.nextDir = dir;
  }
  
  return { ...state.game };
}

export function getGameState(): ServerGameState {
  const state = getGlobal();
  processTicks(state);
  return { ...state.game };
}

export function getMonitorsConfig(): MonitorConfig[] {
  const state = getGlobal();
  return [...state.monitors];
}

export function getPortalsConfig(): Portal[] {
  const state = getGlobal();
  return [...state.portals];
}

export function getGameConfig(): GameConfig {
  const state = getGlobal();
  return { ...state.config };
}

export function updateConfig(newConfig: Partial<GameConfig>): void {
  const state = getGlobal();
  Object.assign(state.config, newConfig);
}

export function setupGame(
  monitorCount: number,
  timerSeconds: number,
  foodPerMonitor: number = 5
): { monitors: MonitorConfig[]; portals: Portal[] } {
  const state = getGlobal();
  
  state.config.monitorCount = monitorCount;
  state.config.timerSeconds = timerSeconds;
  state.config.foodPerMonitor = foodPerMonitor;
  state.monitors = generateMonitors(monitorCount);
  state.portals = generatePortals(state.monitors);
  state.game = createInitialGameState(state.config);
  
  return { monitors: [...state.monitors], portals: [...state.portals] };
}

export function initServerEngine(m: MonitorConfig[], p: Portal[]): void {
  const state = getGlobal();
  state.monitors = m;
  state.portals = p;
}

// Force reload config from file
export function reloadConfig(): GameConfig {
  const fileConfig = loadConfigFromFile();
  const state = getGlobal();
  const newConfig = createConfig(fileConfig);
  state.config = newConfig;
  state.monitors = generateMonitors(newConfig.monitorCount);
  state.portals = generatePortals(state.monitors);
  console.log(`[Snake] Config reloaded: speed=${newConfig.snakeSpeed} (${newConfig.tickIntervalMs}ms)`);
  return { ...newConfig };
}

export const GAME_CONSTANTS = {
  MONITOR_W,
  MONITOR_H,
  DEFAULT_CELL,
  PORTAL_DETECTION_RADIUS: PORTAL_RADIUS,
};
