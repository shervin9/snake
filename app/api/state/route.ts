import { NextResponse } from "next/server";
import { getGameState, getGameConfig, getMonitorsConfig, setupGame } from "@/lib/serverEngine";

export async function GET() {
  // Auto-initialize if needed
  let monitors = getMonitorsConfig();
  if (monitors.length === 0) {
    const config = getGameConfig();
    setupGame(config.monitorCount, config.timerSeconds, config.foodPerMonitor);
  }

  const state = getGameState();
  const config = getGameConfig();

  return NextResponse.json({ state, config });
}
