import { NextResponse } from "next/server";
import {
  startGame,
  stopGameAction,
  resetGame,
  setupGame,
  getGameConfig,
  updateConfig,
  getGameState,
} from "@/lib/serverEngine";

type ControlAction = "setup" | "updateConfig" | "start" | "stop" | "reset";

interface ControlBody {
  action: ControlAction;
  monitorCount?: number;
  timerSeconds?: number;
  foodPerMonitor?: number;
}

/**
 * POST /api/state/control
 * Control game state (setup, start, stop, reset)
 */
export async function POST(req: Request) {
  try {
    const body: ControlBody = await req.json();
    const { action, monitorCount, timerSeconds, foodPerMonitor } = body;

    let result: Record<string, unknown> = {};

    switch (action) {
      case "setup": {
        // Setup game with custom config
        const { monitors, portals } = setupGame(
          monitorCount || 6,
          timerSeconds || 120,
          foodPerMonitor || 5
        );
        result = {
          monitors,
          portals,
          config: getGameConfig(),
          state: getGameState(),
        };
        break;
      }

      case "updateConfig": {
        updateConfig({ monitorCount, timerSeconds, foodPerMonitor });
        result = { config: getGameConfig() };
        break;
      }

      case "start": {
        // #region agent log
        console.log('[DEBUG-API] Control start action, pid:', process.pid);
        // #endregion
        const state = startGame();
        // #region agent log
        console.log('[DEBUG-API] Control start result - phase:', state.phase, 'foods:', state.foods.length);
        // #endregion
        result = { state };
        break;
      }

      case "stop": {
        const state = stopGameAction();
        result = { state };
        break;
      }

      case "reset": {
        const state = resetGame();
        result = { state };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Control API error:", error);
    return NextResponse.json(
      { error: "Failed to process control action" },
      { status: 500 }
    );
  }
}
