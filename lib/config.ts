/**
 * Game Configuration Constants
 * 
 * This file contains all configurable constants for the snake game.
 * Modify these values to adjust game behavior.
 */

// ============================================================================
// Display Constants
// ============================================================================

/** Standard monitor width in pixels */
export const MONITOR_WIDTH = 1920;

/** Standard monitor height in pixels */
export const MONITOR_HEIGHT = 1080;

/** Size of each grid cell in pixels */
export const CELL_SIZE = 30;

/** Grid dimensions per monitor */
export const GRID_COLS = Math.floor(MONITOR_WIDTH / CELL_SIZE);
export const GRID_ROWS = Math.floor(MONITOR_HEIGHT / CELL_SIZE);

// ============================================================================
// Game Timing Constants
// ============================================================================

/** Milliseconds between game ticks (lower = faster snake) */
export const DEFAULT_TICK_INTERVAL = 100;

/** Default game duration in seconds */
export const DEFAULT_GAME_DURATION = 120;

/** Polling interval for state updates (client-side) */
export const STATE_POLL_INTERVAL = 50;

// ============================================================================
// Gameplay Constants
// ============================================================================

/** Default number of monitors */
export const DEFAULT_MONITOR_COUNT = 6;

/** Default food items per monitor */
export const DEFAULT_FOOD_PER_MONITOR = 5;

/** Points awarded per food item */
export const POINTS_PER_FOOD = 10;

/** Distance for portal detection in pixels */
export const PORTAL_DETECTION_RADIUS = 80;

/** Safe distance from portals for food spawning */
export const PORTAL_SAFE_ZONE = PORTAL_DETECTION_RADIUS * 1.5;

/** Grid padding for food spawning (cells from edge) */
export const FOOD_SPAWN_PADDING = 3;

// ============================================================================
// Visual Constants
// ============================================================================

/** Animation tick speed for PIXI rendering */
export const ANIMATION_TICK_SPEED = 0.02;

/** Time threshold for "danger" warning (ms) */
export const DANGER_TIME_THRESHOLD = 30000;

/** Time threshold for "warning" state (ms) */
export const WARNING_TIME_THRESHOLD = 60000;

// ============================================================================
// Multi-Monitor Layout
// ============================================================================

/**
 * Calculate optimal grid layout for monitors
 */
export function calculateMonitorGrid(count: number): { rows: number; cols: number } {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { rows, cols };
}

/**
 * Calculate world dimensions based on monitor count
 */
export function calculateWorldSize(monitorCount: number): { width: number; height: number } {
  const { rows, cols } = calculateMonitorGrid(monitorCount);
  return {
    width: cols * MONITOR_WIDTH,
    height: rows * MONITOR_HEIGHT,
  };
}

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_GAME_CONFIG = {
  monitorCount: DEFAULT_MONITOR_COUNT,
  timerSeconds: DEFAULT_GAME_DURATION,
  foodPerMonitor: DEFAULT_FOOD_PER_MONITOR,
  gridCellSize: CELL_SIZE,
  tickIntervalMs: DEFAULT_TICK_INTERVAL,
};

export const MONITOR_DIMENSIONS = {
  width: MONITOR_WIDTH,
  height: MONITOR_HEIGHT,
  cellSize: CELL_SIZE,
};





