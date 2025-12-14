import { getGameState, getMonitorsConfig, getGameConfig, setupGame } from "@/lib/serverEngine";

// Force dynamic rendering and Node.js runtime
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // Auto-initialize if needed
  let monitors = getMonitorsConfig();
  if (monitors.length === 0) {
    const config = getGameConfig();
    setupGame(config.monitorCount, config.timerSeconds, config.foodPerMonitor);
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      let isActive = true;
      
      const sendState = () => {
        if (!isActive) return;
        
        try {
          const state = getGameState();
          
          // Send minimal state data
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
          
          const data = `data: ${JSON.stringify({ state: minimalState })}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch (error) {
          // Client disconnected or error occurred
          isActive = false;
        }
      };
      
      // Send initial state immediately
      sendState();
      
      // Send state updates at fixed interval (60ms = ~16 updates/sec)
      // This is optimal for smooth animation at 60fps
      const intervalId = setInterval(sendState, 60);
      
      // Cleanup when stream closes
      const cleanup = () => {
        isActive = false;
        clearInterval(intervalId);
      };
      
      // Store cleanup in controller for cancel handling
      (controller as unknown as { cleanup: () => void }).cleanup = cleanup;
    },
    
    cancel(controller) {
      // Call cleanup when client disconnects
      const ctrl = controller as unknown as { cleanup?: () => void };
      if (ctrl.cleanup) {
        ctrl.cleanup();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
