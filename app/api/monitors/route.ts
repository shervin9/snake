import { NextResponse } from "next/server";
import {
  getMonitorsConfig,
  setupGame,
  getGameConfig,
  GAME_CONSTANTS,
} from "@/lib/serverEngine";

/**
 * GET /api/monitors
 * Returns monitor configuration
 */
export async function GET() {
  let monitors = getMonitorsConfig();

  // Auto-initialize if no monitors exist
  if (monitors.length === 0) {
    const config = getGameConfig();
    const result = setupGame(
      config.monitorCount,
      config.timerSeconds,
      config.foodPerMonitor
    );
    monitors = result.monitors;
  }

  return NextResponse.json({
    monitors,
    dimensions: {
      width: GAME_CONSTANTS.MONITOR_W,
      height: GAME_CONSTANTS.MONITOR_H,
      cellSize: GAME_CONSTANTS.DEFAULT_CELL,
    },
  });
}
