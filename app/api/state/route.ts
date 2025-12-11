import { NextResponse } from "next/server";
import {
  getGameState,
  getGameConfig,
  getMonitorsConfig,
  setupGame,
} from "@/lib/serverEngine";

/**
 * GET /api/state
 * Returns current game state and configuration
 */
export async function GET() {
  // Auto-initialize monitors if not set up
  let monitors = getMonitorsConfig();
  if (monitors.length === 0) {
    const config = getGameConfig();
    setupGame(config.monitorCount, config.timerSeconds, config.foodPerMonitor);
  }

  const state = getGameState();
  const config = getGameConfig();

  return NextResponse.json({
    state,
    config,
  });
}
