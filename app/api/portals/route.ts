import { NextResponse } from "next/server";
import {
  getPortalsConfig,
  getMonitorsConfig,
  setupGame,
  getGameConfig,
} from "@/lib/serverEngine";

/**
 * GET /api/portals
 * Returns portal configuration for multi-monitor teleportation
 */
export async function GET() {
  // Ensure monitors are initialized
  let monitors = getMonitorsConfig();
  if (monitors.length === 0) {
    const config = getGameConfig();
    setupGame(config.monitorCount, config.timerSeconds, config.foodPerMonitor);
  }

  const portals = getPortalsConfig();

  return NextResponse.json({
    portals,
    description: "Portals connect monitors allowing the snake to teleport between them",
  });
}
