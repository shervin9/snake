/**
 * Shared types for the Snake Game
 */

// ============================================================================
// Game Core Types
// ============================================================================

export type Direction = "up" | "down" | "left" | "right";
export type Phase = "idle" | "running" | "ended";
export type Theme = "forest" | "ocean" | "fire" | "space";

// ============================================================================
// Position & Grid Types
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface GridCell {
  gx: number;
  gy: number;
}

export interface Segment extends Position {}

// ============================================================================
// Game Entity Types
// ============================================================================

export interface Food {
  id: string;
  x: number;
  y: number;
  monitorId: string;
}

export interface Snake {
  segments: Segment[];
  direction: Direction;
  nextDirection: Direction;
}

// ============================================================================
// Monitor & Portal Types
// ============================================================================

export interface MonitorConfig {
  id: string;
  row: number;
  col: number;
  rotationDeg?: number;
  displayIndex?: number;
  theme?: Theme;
}

export interface Portal {
  id?: string;
  from: string;
  to: string;
  fromPos: Position;
  toPos: Position;
}

export interface MonitorDimensions {
  width: number;
  height: number;
  cellSize: number;
}

// ============================================================================
// Game State Types
// ============================================================================

export interface GameState {
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
}

export interface GameConfig {
  monitorCount: number;
  timerSeconds: number;
  foodPerMonitor: number;
  gridCellSize: number;
  tickIntervalMs: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface StateResponse {
  state: GameState;
  config: GameConfig;
}

export interface MonitorsResponse {
  monitors: MonitorConfig[];
  dimensions: MonitorDimensions;
}

export interface PortalsResponse {
  portals: Portal[];
  description: string;
}

export interface ControlResponse {
  state?: GameState;
  config?: GameConfig;
  monitors?: MonitorConfig[];
  portals?: Portal[];
}

// ============================================================================
// Control Actions
// ============================================================================

export type ControlAction = "setup" | "start" | "stop" | "reset" | "updateConfig";

export interface ControlRequest {
  action: ControlAction;
  monitorCount?: number;
  timerSeconds?: number;
  foodPerMonitor?: number;
}

export interface InputRequest {
  direction: Direction;
}

// ============================================================================
// Event Types
// ============================================================================

export interface GameEvent {
  type: "food_eaten" | "portal_entered" | "collision" | "game_over" | "game_start";
  timestamp: number;
  data?: Record<string, unknown>;
}





