/**
 * Server-side game engine singleton.
 * Handles all game state, collision detection, and multi-monitor support.
 * 
 * Fixed bugs:
 * - Food eating: Now uses grid-cell collision (same cell) instead of distance
 * - Wall collision: Proper boundary checking with clear logic
 * - Food spawn: Grid-aligned positions, no overlap with snake
 * - Self collision: Fixed to check actual grid cell overlap
 * - State persistence: Uses file-based storage for reliable state across requests
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
  nextDir: Direction; // Buffer for next direction (prevents 180° turns)
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
const DEFAULT_TICK_INTERVAL = 100; // ms between game ticks (faster = harder)
const PORTAL_DETECTION_RADIUS = 80; // Distance to trigger portal teleport

// ============================================================================
// File-based State Persistence (survives process restarts)
// ============================================================================

const STATE_FILE = path.join(process.cwd(), '.game-state.json');

interface PersistedState {
  gameState: ServerGameState;
  monitors: MonitorConfig[];
  portals: Portal[];
  config: GameConfig;
}

function loadStateFromFile(): PersistedState | null {
  // #region agent log
  console.log('[DEBUG] loadStateFromFile: entry, pid:', process.pid, 'file exists:', fs.existsSync(STATE_FILE));
  // #endregion
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      // #region agent log
      console.log('[DEBUG] loadStateFromFile: loaded phase:', parsed.gameState?.phase, 'tick:', parsed.gameState?.tick);
      // #endregion
      return parsed;
    }
  } catch (err) {
    console.error('[ServerEngine] Failed to load state file:', err);
  }
  // #region agent log
  console.log('[DEBUG] loadStateFromFile: returning null');
  // #endregion
  return null;
}

function saveStateToFile(): void {
  // #region agent log
  console.log('[DEBUG] saveStateToFile: phase:', globalState.__snakeGameState?.phase, 'tick:', globalState.__snakeGameState?.tick, 'pid:', process.pid);
  // #endregion
  try {
    const data: PersistedState = {
      gameState: globalState.__snakeGameState!,
      monitors: globalState.__snakeMonitors || [],
      portals: globalState.__snakePortals || [],
      config: globalState.__snakeConfig!,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data), 'utf-8');
    // #region agent log
    console.log('[DEBUG] saveStateToFile: saved successfully');
    // #endregion
  } catch (err) {
    console.error('[ServerEngine] Failed to save state file:', err);
  }
}

// ============================================================================
// Global State (with file persistence fallback)
// ============================================================================

const globalState = globalThis as typeof globalThis & {
  __snakeGameState?: ServerGameState;
  __snakeMonitors?: MonitorConfig[];
  __snakePortals?: Portal[];
  __snakeConfig?: GameConfig;
  __snakeInitialized?: boolean;
};

// Initialize from file if not in memory
function ensureInitialized(): void {
  if (globalState.__snakeInitialized) return;
  
  const persisted = loadStateFromFile();
  if (persisted) {
    globalState.__snakeGameState = persisted.gameState;
    globalState.__snakeMonitors = persisted.monitors;
    globalState.__snakePortals = persisted.portals;
    globalState.__snakeConfig = persisted.config;
    console.log('[ServerEngine] Loaded state from file, phase:', persisted.gameState.phase);
  }
  globalState.__snakeInitialized = true;
}

// ============================================================================
// Utility Functions
// ============================================================================

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Convert pixel position to grid cell coordinates
 */
function toGridCell(x: number, y: number, cellSize: number): { gx: number; gy: number } {
  return {
    gx: Math.floor(x / cellSize),
    gy: Math.floor(y / cellSize),
  };
}

/**
 * Convert grid cell to pixel center position
 */
function fromGridCell(gx: number, gy: number, cellSize: number): { x: number; y: number } {
  return {
    x: gx * cellSize + cellSize / 2,
    y: gy * cellSize + cellSize / 2,
  };
}

/**
 * Snap position to grid center
 */
function snapToGrid(x: number, y: number, cellSize: number): { x: number; y: number } {
  const { gx, gy } = toGridCell(x, y, cellSize);
  return fromGridCell(gx, gy, cellSize);
}

// ============================================================================
// State Management
// ============================================================================

function getState(): ServerGameState {
  ensureInitialized();
  
  if (!globalState.__snakeGameState) {
    const cell = getConfig().gridCellSize;
    globalState.__snakeGameState = {
      phase: "idle",
      score: 0,
      dir: "right",
      nextDir: "right",
      snake: [
        { x: MONITOR_W / 2, y: MONITOR_H / 2 },
        { x: MONITOR_W / 2 - cell, y: MONITOR_H / 2 },
      ],
      foods: [],
      activeMonitorId: "0",
      tick: 0,
      lastTickTime: Date.now(),
      timeLeftMs: 120000,
      totalTimeMs: 120000,
    };
  }
  return globalState.__snakeGameState;
}

function getConfig(): GameConfig {
  ensureInitialized();
  
  if (!globalState.__snakeConfig) {
    globalState.__snakeConfig = {
      monitorCount: 6,
      timerSeconds: 120,
      foodPerMonitor: 5,
      gridCellSize: DEFAULT_CELL,
      tickIntervalMs: DEFAULT_TICK_INTERVAL,
    };
  }
  return globalState.__snakeConfig;
}

function getMonitors(): MonitorConfig[] {
  ensureInitialized();
  return globalState.__snakeMonitors || [];
}

function getPortals(): Portal[] {
  ensureInitialized();
  return globalState.__snakePortals || [];
}

// ============================================================================
// Monitor & Portal Logic
// ============================================================================

/**
 * Get the pixel origin (top-left) of a monitor
 */
function monitorOrigin(monitorId: string): { x: number; y: number } {
  const monitors = getMonitors();
  const m = monitors.find((mm) => mm.id === monitorId) ?? monitors[0];
  if (!m) return { x: 0, y: 0 };
  return { x: m.col * MONITOR_W, y: m.row * MONITOR_H };
}

/**
 * Find which monitor a position belongs to
 */
function locateMonitor(pos: { x: number; y: number }): MonitorConfig | undefined {
  const monitors = getMonitors();
  return monitors.find((m) => {
    const origin = monitorOrigin(m.id);
    return (
      pos.x >= origin.x &&
      pos.x < origin.x + MONITOR_W &&
      pos.y >= origin.y &&
      pos.y < origin.y + MONITOR_H
    );
  });
}

/**
 * Check if position is near a portal entrance
 */
function checkPortalEntrance(
  pos: { x: number; y: number },
  currentMonitorId: string
): Portal | null {
  const portals = getPortals();
  const monitorPortals = portals.filter((p) => p.from === currentMonitorId);
  const origin = monitorOrigin(currentMonitorId);

  for (const portal of monitorPortals) {
    const portalWorldX = origin.x + portal.fromPos.x;
    const portalWorldY = origin.y + portal.fromPos.y;
    const dist = Math.hypot(pos.x - portalWorldX, pos.y - portalWorldY);

    if (dist <= PORTAL_DETECTION_RADIUS) {
      return portal;
    }
  }
  return null;
}

/**
 * Check if snake head hits a wall (monitor boundary without portal)
 */
function checkWallCollision(
  pos: { x: number; y: number },
  currentMonitorId: string
): boolean {
  const origin = monitorOrigin(currentMonitorId);
  const cell = getConfig().gridCellSize;
  const padding = cell / 2; // Allow snake to be at edge but not past

  const localX = pos.x - origin.x;
  const localY = pos.y - origin.y;

  // Check boundaries with small padding
  const hitLeft = localX < padding;
  const hitRight = localX > MONITOR_W - padding;
  const hitTop = localY < padding;
  const hitBottom = localY > MONITOR_H - padding;

  if (hitLeft || hitRight || hitTop || hitBottom) {
    // Before declaring game over, check if there's a portal here
    const portal = checkPortalEntrance(pos, currentMonitorId);
    if (portal) {
      return false; // Near portal, not a wall collision
    }
    return true; // Actual wall hit
  }

  return false;
}

// ============================================================================
// Food Management
// ============================================================================

/**
 * Check if a position overlaps with snake
 */
function overlapsSnake(x: number, y: number): boolean {
  const state = getState();
  const cell = getConfig().gridCellSize;
  const { gx, gy } = toGridCell(x, y, cell);

  for (const seg of state.snake) {
    const { gx: sgx, gy: sgy } = toGridCell(seg.x, seg.y, cell);
    if (gx === sgx && gy === sgy) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a position overlaps with existing food
 */
function overlapsFood(x: number, y: number): boolean {
  const state = getState();
  const cell = getConfig().gridCellSize;
  const { gx, gy } = toGridCell(x, y, cell);

  for (const food of state.foods) {
    const { gx: fgx, gy: fgy } = toGridCell(food.x, food.y, cell);
    if (gx === fgx && gy === fgy) {
      return true;
    }
  }
  return false;
}

/**
 * Check if position is near a portal (don't spawn food here)
 */
function nearPortal(x: number, y: number, monitorId: string): boolean {
  const portals = getPortals();
  const monitorPortals = portals.filter(
    (p) => p.from === monitorId || p.to === monitorId
  );
  const origin = monitorOrigin(monitorId);
  const safeDistance = PORTAL_DETECTION_RADIUS * 1.5;

  for (const portal of monitorPortals) {
    const portalPos = portal.from === monitorId ? portal.fromPos : portal.toPos;
    const portalWorldX = origin.x + portalPos.x;
    const portalWorldY = origin.y + portalPos.y;
    const dist = Math.hypot(x - portalWorldX, y - portalWorldY);

    if (dist < safeDistance) {
      return true;
    }
  }
  return false;
}

/**
 * Generate a valid food position on a monitor
 */
function generateFoodPosition(monitorId: string): { x: number; y: number } | null {
  const config = getConfig();
  const cell = config.gridCellSize;
  const origin = monitorOrigin(monitorId);

  // Grid dimensions for this monitor (with padding)
  const gridColsStart = Math.ceil((3 * cell) / cell);
  const gridColsEnd = Math.floor((MONITOR_W - 3 * cell) / cell);
  const gridRowsStart = Math.ceil((3 * cell) / cell);
  const gridRowsEnd = Math.floor((MONITOR_H - 3 * cell) / cell);

  // Try to find valid position (max 100 attempts)
  for (let attempt = 0; attempt < 100; attempt++) {
    const gx = gridColsStart + Math.floor(Math.random() * (gridColsEnd - gridColsStart));
    const gy = gridRowsStart + Math.floor(Math.random() * (gridRowsEnd - gridRowsStart));

    const { x, y } = fromGridCell(gx, gy, cell);
    const worldX = origin.x + x;
    const worldY = origin.y + y;

    // Validate position
    if (overlapsSnake(worldX, worldY)) continue;
    if (overlapsFood(worldX, worldY)) continue;
    if (nearPortal(worldX, worldY, monitorId)) continue;

    return { x: worldX, y: worldY };
  }

  return null; // Could not find valid position
}

/**
 * Generate initial food for all monitors
 */
function generateInitialFoods(): void {
  const state = getState();
  const monitors = getMonitors();
  const config = getConfig();

  state.foods = [];

  for (const monitor of monitors) {
    for (let i = 0; i < config.foodPerMonitor; i++) {
      const pos = generateFoodPosition(monitor.id);
      if (pos) {
        state.foods.push({
          id: makeId(),
          x: pos.x,
          y: pos.y,
          monitorId: monitor.id,
        });
      }
    }
  }
}

/**
 * Spawn new food on a specific monitor (after eating)
 */
function spawnFood(monitorId: string): void {
  const state = getState();
  const pos = generateFoodPosition(monitorId);
  if (pos) {
    state.foods.push({
      id: makeId(),
      x: pos.x,
      y: pos.y,
      monitorId,
    });
  }
}

// ============================================================================
// Collision Detection
// ============================================================================

/**
 * Check if snake head collides with food (grid-cell based)
 * Returns the food item if collision, null otherwise
 */
function checkFoodCollision(): Food | null {
  const state = getState();
  const config = getConfig();
  const cell = config.gridCellSize;
  const head = state.snake[0];
  const { gx: headGx, gy: headGy } = toGridCell(head.x, head.y, cell);

  for (const food of state.foods) {
    const { gx: foodGx, gy: foodGy } = toGridCell(food.x, food.y, cell);
    if (headGx === foodGx && headGy === foodGy) {
      return food;
    }
  }
  return null;
}

/**
 * Check if snake head collides with body (grid-cell based)
 * Skip first few segments to prevent false positives during turns
 */
function checkSelfCollision(): boolean {
  const state = getState();
  const config = getConfig();
  const cell = config.gridCellSize;
  const head = state.snake[0];
  const { gx: headGx, gy: headGy } = toGridCell(head.x, head.y, cell);

  // Start from segment 3 (skip head and neck to allow tight turns)
  for (let i = 3; i < state.snake.length; i++) {
    const seg = state.snake[i];
    const { gx: segGx, gy: segGy } = toGridCell(seg.x, seg.y, cell);
    if (headGx === segGx && headGy === segGy) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// Game Step Logic
// ============================================================================

/**
 * Execute one game tick
 */
function step(): void {
  const state = getState();
  const config = getConfig();
  let monitors = getMonitors();
  const cell = config.gridCellSize;

  // Auto-initialize monitors if needed (handles serverless cold starts)
  if (monitors.length === 0) {
    monitors = generateMonitors(config.monitorCount);
    const portals = generatePortals(monitors);
    globalState.__snakeMonitors = monitors;
    globalState.__snakePortals = portals;
  }

  if (state.phase !== "running") return;

  state.tick += 1;
  
  // #region agent log
  console.log('[DEBUG-STEP] Tick', state.tick, '- snake head:', state.snake[0], 'dir:', state.dir);
  // #endregion

  // Update timer
  const now = Date.now();
  const elapsed = now - state.lastTickTime;
  state.timeLeftMs = Math.max(0, state.timeLeftMs - elapsed);
  state.lastTickTime = now;

  // Check time limit
  if (state.timeLeftMs <= 0) {
    // #region agent log
    console.log('[DEBUG-STEP] Game ended - time limit');
    // #endregion
    state.phase = "ended";
    return;
  }

  // Apply buffered direction change
  state.dir = state.nextDir;

  // Calculate new head position
  const head = state.snake[0];
  const dx = state.dir === "left" ? -cell : state.dir === "right" ? cell : 0;
  const dy = state.dir === "up" ? -cell : state.dir === "down" ? cell : 0;
  let newHead = { x: head.x + dx, y: head.y + dy };
  
  // #region agent log
  console.log('[DEBUG-STEP] New head position:', newHead);
  // #endregion

  // Find current monitor
  const currentMonitor = locateMonitor(head);
  if (!currentMonitor) {
    // Snake outside all monitors - reset to monitor 0
    console.warn("[ServerEngine] Snake outside monitors, repositioning...");
    const start = monitorOrigin("0");
    const startPos = snapToGrid(start.x + MONITOR_W / 2, start.y + MONITOR_H / 2, cell);
    state.snake[0] = startPos;
    state.activeMonitorId = "0";
    return; // Skip this tick, will continue next tick
  }

  // Check for portal teleportation
  const portal = checkPortalEntrance(newHead, currentMonitor.id);
  if (portal) {
    const toOrigin = monitorOrigin(portal.to);
    newHead = snapToGrid(
      toOrigin.x + portal.toPos.x,
      toOrigin.y + portal.toPos.y,
      cell
    );
    state.activeMonitorId = portal.to;
  } else {
    // Check wall collision (only if not going through portal)
    if (checkWallCollision(newHead, currentMonitor.id)) {
      // #region agent log
      console.log('[DEBUG-STEP] Game ended - wall collision at', newHead, 'monitor:', currentMonitor.id);
      // #endregion
      state.phase = "ended";
      return;
    }
  }

  // Move snake (temporarily, before collision checks)
  const prevSnake = [...state.snake];
  state.snake = [newHead, ...state.snake.slice(0, -1)];

  // Check self collision
  if (checkSelfCollision()) {
    // #region agent log
    console.log('[DEBUG-STEP] Game ended - self collision');
    // #endregion
    state.snake = prevSnake; // Restore
    state.phase = "ended";
    return;
  }

  // Update active monitor
  const headMonitor = locateMonitor(newHead);
  if (headMonitor) {
    state.activeMonitorId = headMonitor.id;
  }

  // Check food collision
  const eatenFood = checkFoodCollision();
  if (eatenFood) {
    // Remove eaten food
    state.foods = state.foods.filter((f) => f.id !== eatenFood.id);
    state.score += 10;

    // Grow snake (add segment at tail)
    const tail = state.snake[state.snake.length - 1];
    state.snake.push({ ...tail });

    // Spawn new food on same monitor
    spawnFood(eatenFood.monitorId);
  }
}

/**
 * Process accumulated ticks since last call
 */
function processTicks(): void {
  const state = getState();
  const config = getConfig();

  // #region agent log
  console.log('[DEBUG-TICK] processTicks called - phase:', state.phase, 'tick:', state.tick, 'lastTickTime:', state.lastTickTime);
  // #endregion

  if (state.phase !== "running") return;

  const now = Date.now();
  const elapsed = now - state.lastTickTime;
  const ticksToProcess = Math.floor(elapsed / config.tickIntervalMs);

  // #region agent log
  console.log('[DEBUG-TICK] Time check - now:', now, 'elapsed:', elapsed, 'tickInterval:', config.tickIntervalMs, 'ticksToProcess:', ticksToProcess);
  // #endregion

  if (ticksToProcess > 0) {
    // Cap at 10 ticks to prevent catchup lag
    const maxTicks = Math.min(ticksToProcess, 10);
    // #region agent log
    console.log('[DEBUG-TICK] Processing', maxTicks, 'ticks');
    // #endregion
    for (let i = 0; i < maxTicks; i++) {
      step();
      if (state.phase !== "running") break;
    }
    state.lastTickTime = now;
    
    // #region agent log
    console.log('[DEBUG-TICK] After processing - tick:', state.tick, 'phase:', state.phase);
    // #endregion
    
    // Persist state periodically (every tick batch)
    saveStateToFile();
  }
}

// ============================================================================
// Monitor & Portal Generation
// ============================================================================

function generateMonitors(count: number): MonitorConfig[] {
  const monitors: MonitorConfig[] = [];
  const cols = Math.ceil(Math.sqrt(count));

  let id = 0;
  let row = 0;
  let col = 0;

  while (id < count) {
    monitors.push({ id: String(id), row, col });
    col++;
    if (col >= cols) {
      col = 0;
      row++;
    }
    id++;
  }

  return monitors;
}

function generatePortals(monitors: MonitorConfig[]): Portal[] {
  const portals: Portal[] = [];

  if (monitors.length <= 1) return portals;

  // Create a ring of portals connecting monitors
  for (let i = 0; i < monitors.length; i++) {
    const nextIdx = (i + 1) % monitors.length;
    const from = monitors[i];
    const to = monitors[nextIdx];

    // Portal at right edge, connecting to left edge of next
    portals.push({
      from: from.id,
      to: to.id,
      fromPos: { x: MONITOR_W - 80, y: MONITOR_H / 2 },
      toPos: { x: 100, y: MONITOR_H / 2 },
    });
  }

  return portals;
}

// ============================================================================
// Public API
// ============================================================================

export function updateConfig(config: Partial<GameConfig>): void {
  const current = getConfig();
  Object.assign(current, config);
  globalState.__snakeConfig = current;
}

export function getGameConfig(): GameConfig {
  return { ...getConfig() };
}

export function initServerEngine(monitors: MonitorConfig[], portals: Portal[]): void {
  globalState.__snakeMonitors = monitors;
  globalState.__snakePortals = portals;

  const state = getState();
  const config = getConfig();

  // Reset snake to monitor 0 center
  if (monitors.length > 0) {
    const start = monitorOrigin("0");
    const cell = config.gridCellSize;
    const startPos = snapToGrid(
      start.x + MONITOR_W / 2,
      start.y + MONITOR_H / 2,
      cell
    );

    state.snake = [
      startPos,
      { x: startPos.x - cell, y: startPos.y },
    ];
  }
}

export function setupGame(
  monitorCount: number,
  timerSeconds: number,
  foodPerMonitor: number = 5
): { monitors: MonitorConfig[]; portals: Portal[] } {
  updateConfig({ monitorCount, timerSeconds, foodPerMonitor });

  const monitors = generateMonitors(monitorCount);
  const portals = generatePortals(monitors);

  globalState.__snakeMonitors = monitors;
  globalState.__snakePortals = portals;

  // Reset state
  resetGame();
  
  // Save to file
  saveStateToFile();

  return { monitors, portals };
}

export function startGame(): ServerGameState {
  const state = getState();
  
  // #region agent log
  console.log('[DEBUG-START] Entry - current phase:', state.phase, 'pid:', process.pid);
  // #endregion
  
  // Prevent starting if already running
  if (state.phase === "running") {
    // #region agent log
    console.log('[DEBUG-START] Already running, ignoring start request');
    // #endregion
    return { ...state };
  }
  
  const config = getConfig();
  const cell = config.gridCellSize;

  // Auto-setup monitors and portals if not already configured
  let monitors = getMonitors();
  if (monitors.length === 0) {
    console.log("[ServerEngine] No monitors configured, auto-generating...");
    monitors = generateMonitors(config.monitorCount);
    const portals = generatePortals(monitors);
    globalState.__snakeMonitors = monitors;
    globalState.__snakePortals = portals;
    console.log(`[ServerEngine] Generated ${monitors.length} monitors and ${portals.length} portals`);
  }

  const start = monitorOrigin("0");
  const startPos = snapToGrid(
    start.x + MONITOR_W / 2,
    start.y + MONITOR_H / 2,
    cell
  );

  state.phase = "running";
  state.score = 0;
  state.dir = "right";
  state.nextDir = "right";
  state.snake = [
    startPos,
    { x: startPos.x - cell, y: startPos.y },
  ];
  state.activeMonitorId = "0";
  state.tick = 0;
  state.lastTickTime = Date.now();
  state.totalTimeMs = config.timerSeconds * 1000;
  state.timeLeftMs = config.timerSeconds * 1000;

  // Generate foods AFTER monitors are configured
  generateInitialFoods();
  console.log(`[ServerEngine] Game started! Foods: ${state.foods.length}, Monitors: ${monitors.length}`);

  // Persist state to file
  saveStateToFile();

  // #region agent log
  console.log('[DEBUG-START] Exit - phase:', state.phase, 'foods:', state.foods.length, 'tick:', state.tick);
  // #endregion

  return { ...state };
}

export function stopGameAction(): ServerGameState {
  const state = getState();
  state.phase = "ended";
  saveStateToFile();
  return { ...state };
}

export function resetGame(): ServerGameState {
  const state = getState();
  const config = getConfig();
  const cell = config.gridCellSize;

  const start = monitorOrigin("0");
  const startPos = snapToGrid(
    start.x + MONITOR_W / 2,
    start.y + MONITOR_H / 2,
    cell
  );

  state.phase = "idle";
  state.score = 0;
  state.dir = "right";
  state.nextDir = "right";
  state.snake = [
    startPos,
    { x: startPos.x - cell, y: startPos.y },
  ];
  state.foods = [];
  state.activeMonitorId = "0";
  state.tick = 0;
  state.lastTickTime = Date.now();
  state.totalTimeMs = config.timerSeconds * 1000;
  state.timeLeftMs = config.timerSeconds * 1000;

  saveStateToFile();
  return { ...state };
}

export function setDirection(dir: Direction): ServerGameState {
  const state = getState();

  // Prevent 180-degree turns
  const opposite: Record<Direction, Direction> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };

  if (opposite[dir] !== state.dir) {
    state.nextDir = dir; // Buffer the direction change
    saveStateToFile();
  }

  return { ...state };
}

export function getGameState(): ServerGameState {
  // #region agent log
  const beforePhase = globalState.__snakeGameState?.phase;
  // #endregion
  
  // Ensure monitors are always configured (handles serverless cold starts)
  const monitors = getMonitors();
  if (monitors.length === 0) {
    const config = getConfig();
    const newMonitors = generateMonitors(config.monitorCount);
    const newPortals = generatePortals(newMonitors);
    globalState.__snakeMonitors = newMonitors;
    globalState.__snakePortals = newPortals;
  }
  
  processTicks();
  const finalState = { ...getState() };
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6187c2f3-4398-4a96-8981-ced766ad6ee8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'serverEngine.ts:getGameState',message:'getGameState called',data:{beforePhase,afterPhase:finalState.phase,tick:finalState.tick,pid:process.pid},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  return finalState;
}

export function getMonitorsConfig(): MonitorConfig[] {
  return [...getMonitors()];
}

export function getPortalsConfig(): Portal[] {
  return [...getPortals()];
}

// Export constants for use in other modules
export const GAME_CONSTANTS = {
  MONITOR_W,
  MONITOR_H,
  DEFAULT_CELL,
  DEFAULT_TICK_INTERVAL,
  PORTAL_DETECTION_RADIUS,
};
