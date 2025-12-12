/**
 * Server-side game engine - SIMPLIFIED VERSION
 * Pure in-memory state, no file persistence.
 * Requires PM2 fork mode (single instance) to work properly.
 */

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

// ============================================================================
// Global State (using globalThis for Next.js compatibility)
// ============================================================================

const g = globalThis as typeof globalThis & {
  __snakeConfig?: GameConfig;
  __snakeMonitors?: MonitorConfig[];
  __snakePortals?: Portal[];
  __snakeState?: ServerGameState;
  __snakeInit?: boolean;
};

// Getters/setters for global state
function getConfig(): GameConfig {
  if (!g.__snakeConfig) {
    g.__snakeConfig = {
      monitorCount: 6,
      timerSeconds: 120,
      foodPerMonitor: 5,
      gridCellSize: DEFAULT_CELL,
      tickIntervalMs: DEFAULT_TICK_INTERVAL,
    };
  }
  return g.__snakeConfig;
}

function getMonitorsArray(): MonitorConfig[] {
  if (!g.__snakeMonitors) g.__snakeMonitors = [];
  return g.__snakeMonitors;
}

function getPortalsArray(): Portal[] {
  if (!g.__snakePortals) g.__snakePortals = [];
  return g.__snakePortals;
}

function getState(): ServerGameState | null {
  return g.__snakeState || null;
}

function setState(s: ServerGameState): void {
  g.__snakeState = s;
}

// Aliases for backward compatibility
let config = getConfig();
let monitors = getMonitorsArray();
let portals = getPortalsArray();
let gameState = getState();

// Initialize on module load
function initialize(): void {
  if (g.__snakeInit) return;
  g.__snakeInit = true;
  
  config = getConfig();
  monitors = getMonitorsArray();
  portals = getPortalsArray();
  
  // Generate monitors in grid layout
  monitors.length = 0;
  const cols = Math.ceil(Math.sqrt(config.monitorCount));
  for (let i = 0; i < config.monitorCount; i++) {
    monitors.push({
      id: String(i),
      row: Math.floor(i / cols),
      col: i % cols,
    });
  }
  g.__snakeMonitors = monitors;
  
  // Generate portals connecting monitors in a ring
  portals.length = 0;
  for (let i = 0; i < monitors.length; i++) {
    const next = (i + 1) % monitors.length;
    portals.push({
      from: monitors[i].id,
      to: monitors[next].id,
      fromPos: { x: MONITOR_W - 80, y: MONITOR_H / 2 },
      toPos: { x: 100, y: MONITOR_H / 2 },
    });
  }
  g.__snakePortals = portals;
  
  // Initialize game state
  const cell = config.gridCellSize;
  const startX = MONITOR_W / 2;
  const startY = MONITOR_H / 2;
  
  const initialState: ServerGameState = {
    phase: "idle",
    score: 0,
    dir: "right",
    nextDir: "right",
    snake: [
      { x: startX, y: startY },
      { x: startX - cell, y: startY },
    ],
    foods: [],
    activeMonitorId: "0",
    tick: 0,
    lastTickTime: Date.now(),
    timeLeftMs: config.timerSeconds * 1000,
    totalTimeMs: config.timerSeconds * 1000,
  };
  setState(initialState);
  gameState = initialState;
  
  console.log(`[Snake] Initialized: ${monitors.length} monitors, ${portals.length} portals`);
}

initialize();

// ============================================================================
// Utility Functions
// ============================================================================

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function monitorOrigin(id: string): { x: number; y: number } {
  const m = monitors.find((mm) => mm.id === id) ?? monitors[0];
  return m ? { x: m.col * MONITOR_W, y: m.row * MONITOR_H } : { x: 0, y: 0 };
}

function findMonitor(pos: { x: number; y: number }): MonitorConfig | undefined {
  return monitors.find((m) => {
    const ox = m.col * MONITOR_W;
    const oy = m.row * MONITOR_H;
    return pos.x >= ox && pos.x < ox + MONITOR_W && pos.y >= oy && pos.y < oy + MONITOR_H;
  });
}

function snapToGrid(x: number, y: number): { x: number; y: number } {
  const cell = config.gridCellSize;
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  return { x: gx * cell + cell / 2, y: gy * cell + cell / 2 };
}

// ============================================================================
// Food Generation
// ============================================================================

function spawnFoods(): void {
  gameState = getState();
  if (!gameState) return;
  gameState.foods = [];
  
  for (const m of monitors) {
    const ox = m.col * MONITOR_W;
    const oy = m.row * MONITOR_H;
    
    for (let i = 0; i < config.foodPerMonitor; i++) {
      const x = ox + 100 + Math.random() * (MONITOR_W - 200);
      const y = oy + 100 + Math.random() * (MONITOR_H - 200);
      const pos = snapToGrid(x, y);
      
      gameState.foods.push({
        id: makeId(),
        x: pos.x,
        y: pos.y,
        monitorId: m.id,
      });
    }
  }
}

function respawnFood(monitorId: string): void {
  gameState = getState();
  if (!gameState) return;
  
  const m = monitors.find((mm) => mm.id === monitorId);
  if (!m) return;
  
  const ox = m.col * MONITOR_W;
  const oy = m.row * MONITOR_H;
  const x = ox + 100 + Math.random() * (MONITOR_W - 200);
  const y = oy + 100 + Math.random() * (MONITOR_H - 200);
  const pos = snapToGrid(x, y);
  
  gameState.foods.push({
    id: makeId(),
    x: pos.x,
    y: pos.y,
    monitorId,
  });
}

// ============================================================================
// Game Logic
// ============================================================================

function step(): void {
  gameState = getState();
  if (!gameState || gameState.phase !== "running") return;
  
  const cell = config.gridCellSize;
  const head = gameState.snake[0];
  
  // Calculate new head position
  const dx = gameState.dir === "left" ? -cell : gameState.dir === "right" ? cell : 0;
  const dy = gameState.dir === "up" ? -cell : gameState.dir === "down" ? cell : 0;
  let newHead = { x: head.x + dx, y: head.y + dy };
  
  // Find current monitor
  const currentMon = findMonitor(head);
  if (!currentMon) {
    // Reset to center if lost
    newHead = { x: MONITOR_W / 2, y: MONITOR_H / 2 };
  } else {
    const ox = currentMon.col * MONITOR_W;
    const oy = currentMon.row * MONITOR_H;
    const localX = newHead.x - ox;
    const localY = newHead.y - oy;
    
    // Check for portal
    let throughPortal = false;
    for (const p of portals) {
      if (p.from === currentMon.id) {
        const dist = Math.hypot(localX - p.fromPos.x, localY - p.fromPos.y);
        if (dist < PORTAL_RADIUS) {
          const toOrigin = monitorOrigin(p.to);
          newHead = snapToGrid(toOrigin.x + p.toPos.x, toOrigin.y + p.toPos.y);
          gameState.activeMonitorId = p.to;
          throughPortal = true;
          break;
        }
      }
    }
    
    // Check wall collision (only if not through portal)
    if (!throughPortal) {
      if (localX < cell || localX > MONITOR_W - cell || localY < cell || localY > MONITOR_H - cell) {
        gameState.phase = "ended";
        console.log("[Snake] Game over: wall collision");
        return;
      }
    }
  }
  
  // Move snake
  gameState.snake.unshift(newHead);
  
  // Check food collision
  const cell2 = cell * cell;
  let ate = false;
  for (let i = gameState.foods.length - 1; i >= 0; i--) {
    const f = gameState.foods[i];
    const dist2 = (newHead.x - f.x) ** 2 + (newHead.y - f.y) ** 2;
    if (dist2 < cell2) {
      gameState.foods.splice(i, 1);
      gameState.score += 10;
      respawnFood(f.monitorId);
      ate = true;
      break;
    }
  }
  
  if (!ate) {
    gameState.snake.pop(); // Remove tail if didn't eat
  }
  
  // Check self collision (skip first 3 segments)
  for (let i = 3; i < gameState.snake.length; i++) {
    const seg = gameState.snake[i];
    if (Math.abs(newHead.x - seg.x) < cell / 2 && Math.abs(newHead.y - seg.y) < cell / 2) {
      gameState.phase = "ended";
      console.log("[Snake] Game over: self collision");
      return;
    }
  }
  
  // Apply buffered direction
  gameState.dir = gameState.nextDir;
  gameState.tick++;
  
  // Update timer
  const now = Date.now();
  gameState.timeLeftMs -= now - gameState.lastTickTime;
  gameState.lastTickTime = now;
  
  if (gameState.timeLeftMs <= 0) {
    gameState.phase = "ended";
    console.log("[Snake] Game over: time up");
  }
}

function processTicks(): void {
  gameState = getState();
  if (!gameState || gameState.phase !== "running") return;
  
  const now = Date.now();
  const elapsed = now - gameState.lastTickTime;
  const ticks = Math.floor(elapsed / config.tickIntervalMs);
  
  if (ticks > 0) {
    const maxTicks = Math.min(ticks, 5);
    for (let i = 0; i < maxTicks; i++) {
      step();
      if (gameState.phase !== "running") break;
    }
    gameState.lastTickTime = now;
  }
}

// ============================================================================
// Public API
// ============================================================================

export function startGame(): ServerGameState {
  initialize();
  gameState = getState();
  config = getConfig();
  monitors = getMonitorsArray();
  
  if (!gameState) throw new Error("Game not initialized");
  
  if (gameState.phase === "running") {
    return { ...gameState };
  }
  
  const cell = config.gridCellSize;
  const startX = MONITOR_W / 2;
  const startY = MONITOR_H / 2;
  
  gameState.phase = "running";
  gameState.score = 0;
  gameState.dir = "right";
  gameState.nextDir = "right";
  gameState.snake = [
    snapToGrid(startX, startY),
    snapToGrid(startX - cell, startY),
  ];
  gameState.activeMonitorId = "0";
  gameState.tick = 0;
  gameState.lastTickTime = Date.now();
  gameState.timeLeftMs = config.timerSeconds * 1000;
  gameState.totalTimeMs = config.timerSeconds * 1000;
  
  spawnFoods();
  setState(gameState); // Persist to globalThis
  
  console.log(`[Snake] Game started! Foods: ${gameState.foods.length}`);
  return { ...gameState };
}

export function stopGameAction(): ServerGameState {
  initialize();
  gameState = getState();
  if (!gameState) throw new Error("Game not initialized");
  gameState.phase = "ended";
  setState(gameState);
  return { ...gameState };
}

export function resetGame(): ServerGameState {
  initialize();
  gameState = getState();
  config = getConfig();
  if (!gameState) throw new Error("Game not initialized");
  
  const cell = config.gridCellSize;
  const startX = MONITOR_W / 2;
  const startY = MONITOR_H / 2;
  
  gameState.phase = "idle";
  gameState.score = 0;
  gameState.dir = "right";
  gameState.nextDir = "right";
  gameState.snake = [
    snapToGrid(startX, startY),
    snapToGrid(startX - cell, startY),
  ];
  gameState.foods = [];
  gameState.activeMonitorId = "0";
  gameState.tick = 0;
  gameState.lastTickTime = Date.now();
  gameState.timeLeftMs = config.timerSeconds * 1000;
  gameState.totalTimeMs = config.timerSeconds * 1000;
  
  setState(gameState);
  return { ...gameState };
}

export function setDirection(dir: Direction): ServerGameState {
  initialize();
  gameState = getState();
  if (!gameState) throw new Error("Game not initialized");
  
  const opposite: Record<Direction, Direction> = {
    up: "down", down: "up", left: "right", right: "left"
  };
  
  if (opposite[dir] !== gameState.dir) {
    gameState.nextDir = dir;
    setState(gameState);
  }
  
  return { ...gameState };
}

export function getGameState(): ServerGameState {
  initialize();
  gameState = getState();
  if (!gameState) throw new Error("Game not initialized");
  processTicks();
  setState(gameState); // Persist any changes from tick processing
  return { ...gameState };
}

export function getMonitorsConfig(): MonitorConfig[] {
  initialize();
  return [...getMonitorsArray()];
}

export function getPortalsConfig(): Portal[] {
  initialize();
  return [...getPortalsArray()];
}

export function getGameConfig(): GameConfig {
  return { ...getConfig() };
}

export function updateConfig(newConfig: Partial<GameConfig>): void {
  const cfg = getConfig();
  Object.assign(cfg, newConfig);
  g.__snakeConfig = cfg;
}

export function setupGame(
  monitorCount: number,
  timerSeconds: number,
  foodPerMonitor: number = 5
): { monitors: MonitorConfig[]; portals: Portal[] } {
  const cfg = getConfig();
  cfg.monitorCount = monitorCount;
  cfg.timerSeconds = timerSeconds;
  cfg.foodPerMonitor = foodPerMonitor;
  g.__snakeConfig = cfg;
  
  // Re-initialize with new config
  g.__snakeMonitors = [];
  g.__snakePortals = [];
  g.__snakeState = undefined;
  g.__snakeInit = false;
  initialize();
  
  return { monitors: [...getMonitorsArray()], portals: [...getPortalsArray()] };
}

export function initServerEngine(m: MonitorConfig[], p: Portal[]): void {
  monitors = m;
  portals = p;
}

export const GAME_CONSTANTS = {
  MONITOR_W,
  MONITOR_H,
  DEFAULT_CELL,
  DEFAULT_TICK_INTERVAL,
  PORTAL_DETECTION_RADIUS: PORTAL_RADIUS,
};
