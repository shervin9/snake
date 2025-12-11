import { NextResponse } from "next/server";
import { setDirection, getGameState, type Direction } from "@/lib/serverEngine";

interface InputBody {
  direction: string;
}

const VALID_DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

/**
 * POST /api/state/input
 * Handle directional input for snake movement
 */
export async function POST(req: Request) {
  try {
    const body: InputBody = await req.json();
    const { direction } = body;

    if (!VALID_DIRECTIONS.includes(direction as Direction)) {
      return NextResponse.json(
        { error: `Invalid direction: ${direction}. Valid: ${VALID_DIRECTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const state = setDirection(direction as Direction);
    
    return NextResponse.json({
      success: true,
      direction,
      currentDir: state.dir,
    });
  } catch (error) {
    console.error("Input API error:", error);
    return NextResponse.json(
      { error: "Failed to process input" },
      { status: 500 }
    );
  }
}
