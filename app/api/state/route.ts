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

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6187c2f3-4398-4a96-8981-ced766ad6ee8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/state:GET',message:'State API called',data:{phase:state.phase,tick:state.tick,foods:state.foods.length,pid:process.pid},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})}).catch(()=>{});
  // #endregion

  return NextResponse.json({
    state,
    config,
  });
}
