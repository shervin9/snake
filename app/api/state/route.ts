import { NextResponse } from "next/server";
import { getGameState, getGameConfig, getMonitorsConfig, setupGame } from "@/lib/serverEngine";

// Force dynamic rendering and Node.js runtime
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Pre-create headers for faster response
const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function GET() {
  // Auto-initialize if needed
  let monitors = getMonitorsConfig();
  if (monitors.length === 0) {
    const config = getGameConfig();
    setupGame(config.monitorCount, config.timerSeconds, config.foodPerMonitor);
  }

  const state = getGameState();
  
  // Only send essential state data to reduce payload size
  // Config is fetched separately and cached by clients
  const minimalState = {
    phase: state.phase,
    score: state.score,
    dir: state.dir,
    snake: state.snake,
    foods: state.foods,
    activeMonitorId: state.activeMonitorId,
    tick: state.tick,
    timeLeftMs: state.timeLeftMs,
  };

  return new NextResponse(JSON.stringify({ state: minimalState }), {
    headers: jsonHeaders,
  });
}
