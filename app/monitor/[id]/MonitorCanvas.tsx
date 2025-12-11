"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as PIXI from "pixi.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Play, AlertTriangle, Monitor, Trophy, Timer } from "lucide-react";

// ============================================================================
// Constants
// ============================================================================

const MONITOR_W = 1920;
const MONITOR_H = 1080;
const CELL = 30;

// Modern color theme
const THEME = {
  // Background
  bg: 0x0f172a, // slate-900
  bgGradientStart: 0x1e293b, // slate-800
  bgGradientEnd: 0x0f172a, // slate-900

  // Grid
  grid: 0x334155, // slate-700
  gridStrong: 0x475569, // slate-600
  gridAccent: 0x10b981, // emerald-500

  // Snake
  snakeHead: 0x10b981, // emerald-500
  snakeHeadGlow: 0x34d399, // emerald-400
  snakeBody: 0x34d399, // emerald-400
  snakeBodyAlt: 0x6ee7b7, // emerald-300
  snakeTail: 0xa7f3d0, // emerald-200

  // Food
  food: 0xf43f5e, // rose-500
  foodGlow: 0xfb7185, // rose-400
  foodAlt: 0xfbbf24, // amber-400

  // Portal
  portalOuter: 0x8b5cf6, // violet-500
  portalInner: 0xa78bfa, // violet-400
  portalCore: 0x6d28d9, // violet-700

  // UI
  text: 0xf8fafc, // slate-50
  textMuted: 0x94a3b8, // slate-400
  gold: 0xfbbf24, // amber-400
  danger: 0xf43f5e, // rose-500
  success: 0x10b981, // emerald-500
};

// ============================================================================
// Types
// ============================================================================

type MonitorConfig = {
  id: string;
  row: number;
  col: number;
  rotationDeg?: number;
};

type Portal = {
  from: string;
  to: string;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
};

type GameState = {
  phase: "idle" | "running" | "ended";
  score: number;
  dir: "up" | "down" | "left" | "right";
  snake: { x: number; y: number }[];
  foods: { id: string; x: number; y: number; monitorId: string }[];
  activeMonitorId: string;
  tick: number;
  timeLeftMs: number;
  totalTimeMs: number;
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatTime(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

// ============================================================================
// Component
// ============================================================================

export function MonitorCanvas({ monitorId }: { monitorId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const prevStateRef = useRef<GameState | null>(null);

  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [isIdle, setIsIdle] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Fetch config and portals
  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        const [monRes, portRes] = await Promise.all([
          fetch("/api/monitors").then((r) => r.json()),
          fetch("/api/portals").then((r) => r.json()),
        ]);

        const found = (monRes.monitors as MonitorConfig[]).find(
          (m) => m.id === monitorId
        );
        if (found) {
          setConfig(found);
        } else {
          setError(`Monitor ${monitorId} not found in configuration`);
        }

        setPortals(portRes.portals || []);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch monitor configuration");
        setLoading(false);
      }
    };
    fetchData();
  }, [monitorId]);

  // Poll game state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch("/api/state");
        const data = await res.json();
        prevStateRef.current = stateRef.current;
        stateRef.current = data.state;
        setIsIdle(data.state?.phase === "idle");
        setCurrentScore(data.state?.score ?? 0);
        setCurrentTime(data.state?.timeLeftMs ?? 0);
      } catch (err) {
        // Silent fail for polling
      }
    };
    fetchState();
    const interval = setInterval(fetchState, 50);
    return () => clearInterval(interval);
  }, []);

  // Keyboard input - Only enabled on monitor 0 (or use admin panel for control)
  useEffect(() => {
    // Skip keyboard input on display monitors - control from admin panel only
    // Uncomment the next line to enable keyboard control on all monitors
    // if (monitorId !== "0") return;
    
    const sendInput = async (direction: "up" | "down" | "left" | "right") => {
      try {
        await fetch("/api/state/input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction }),
        });
      } catch (err) {
        console.error(err);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const dir = e.key.replace("Arrow", "").toLowerCase() as any;
        sendInput(dir);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [monitorId]);

  // Start game handler
  const handleStartGame = useCallback(async () => {
    try {
      await fetch("/api/state/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  // PIXI.js setup and render loop
  useEffect(() => {
    if (!containerRef.current || !config) return;

    // Create PIXI Application
    const app = new PIXI.Application({
      resizeTo: containerRef.current,
      backgroundColor: THEME.bg,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // Container hierarchy
    const rootContainer = new PIXI.Container();
    app.stage.addChild(rootContainer);

    const gameWorld = new PIXI.Container();
    rootContainer.addChild(gameWorld);

    // Background with gradient effect
    const bgLayer = new PIXI.Container();
    const gridLayer = new PIXI.Container();
    const portalLayer = new PIXI.Container();
    const entityLayer = new PIXI.Container();
    const effectsLayer = new PIXI.Container();

    gameWorld.addChild(bgLayer);
    gameWorld.addChild(gridLayer);
    gameWorld.addChild(portalLayer);
    gameWorld.addChild(entityLayer);
    gameWorld.addChild(effectsLayer);

    // UI Layer (separate from game world for proper positioning)
    const uiLayer = new PIXI.Container();
    rootContainer.addChild(uiLayer);

    // ================================================================
    // Draw Background
    // ================================================================

    const drawBackground = () => {
      bgLayer.removeChildren();

      // Main background
      const bg = new PIXI.Graphics();
      bg.beginFill(THEME.bg);
      bg.drawRect(0, 0, MONITOR_W, MONITOR_H);
      bg.endFill();
      bgLayer.addChild(bg);

      // Gradient overlay
      const gradient = new PIXI.Graphics();
      gradient.beginFill(THEME.bgGradientStart, 0.3);
      gradient.drawRect(0, 0, MONITOR_W, MONITOR_H / 3);
      gradient.endFill();
      bgLayer.addChild(gradient);

      // Subtle grid dots pattern
      for (let x = CELL; x < MONITOR_W; x += CELL * 2) {
        for (let y = CELL; y < MONITOR_H; y += CELL * 2) {
          const dot = new PIXI.Graphics();
          dot.beginFill(THEME.grid, 0.2);
          dot.drawCircle(x, y, 1);
          dot.endFill();
          bgLayer.addChild(dot);
        }
      }
    };
    drawBackground();

    // ================================================================
    // Draw Grid
    // ================================================================

    const grid = new PIXI.Graphics();
    gridLayer.addChild(grid);

    const drawGrid = () => {
      grid.clear();

      // Subtle grid lines
      for (let x = 0; x <= MONITOR_W; x += CELL) {
        const isStrong = (x / CELL) % 10 === 0;
        grid.lineStyle(1, isStrong ? THEME.gridStrong : THEME.grid, isStrong ? 0.3 : 0.1);
        grid.moveTo(x, 0);
        grid.lineTo(x, MONITOR_H);
      }

      for (let y = 0; y <= MONITOR_H; y += CELL) {
        const isStrong = (y / CELL) % 10 === 0;
        grid.lineStyle(1, isStrong ? THEME.gridStrong : THEME.grid, isStrong ? 0.3 : 0.1);
        grid.moveTo(0, y);
        grid.lineTo(MONITOR_W, y);
      }

      // Border with glow effect
      grid.lineStyle(4, THEME.gridAccent, 0.5);
      grid.drawRect(2, 2, MONITOR_W - 4, MONITOR_H - 4);
    };
    drawGrid();

    // ================================================================
    // Setup Portals
    // ================================================================

    const portalContainers: Map<string, PIXI.Container> = new Map();

    const setupPortals = () => {
      portalLayer.removeChildren();
      portalContainers.clear();

      const myPortals = portals.filter((p) => p.from === monitorId);

      myPortals.forEach((portal, idx) => {
        const pCont = new PIXI.Container();
        pCont.position.set(portal.fromPos.x, portal.fromPos.y);

        // Portal rings graphics (will be animated)
        const rings = new PIXI.Graphics();
        pCont.addChild(rings);

        // Portal label
        const label = new PIXI.Text(`→ M${portal.to}`, {
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 14,
          fill: 0xffffff,
          fontWeight: "600",
        });
        label.anchor.set(0.5);
        label.y = -60;
        label.alpha = 0.8;
        pCont.addChild(label);

        portalContainers.set(`portal-${idx}`, pCont);
        portalLayer.addChild(pCont);
      });
    };
    setupPortals();

    // ================================================================
    // UI Elements
    // ================================================================

    // Score display
    const scoreText = new PIXI.Text("Score: 0", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 28,
      fill: THEME.gold,
      fontWeight: "bold",
    });
    scoreText.anchor.set(1, 0);
    uiLayer.addChild(scoreText);

    // Timer display
    const timerText = new PIXI.Text("Time: 0:00", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 28,
      fill: THEME.text,
      fontWeight: "bold",
    });
    timerText.anchor.set(0, 0);
    uiLayer.addChild(timerText);

    // Monitor label
    const monitorLabel = new PIXI.Text(`Monitor ${monitorId}`, {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 16,
      fill: THEME.textMuted,
      fontWeight: "600",
    });
    monitorLabel.anchor.set(0.5, 0);
    uiLayer.addChild(monitorLabel);

    // Game over overlay
    const gameOverCont = new PIXI.Container();
    gameOverCont.visible = false;
    uiLayer.addChild(gameOverCont);

    const gameOverBg = new PIXI.Graphics();
    gameOverCont.addChild(gameOverBg);

    const gameOverText = new PIXI.Text("GAME OVER", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 72,
      fill: THEME.danger,
      fontWeight: "900",
      letterSpacing: 4,
    });
    gameOverText.anchor.set(0.5);
    gameOverCont.addChild(gameOverText);

    const finalScoreText = new PIXI.Text("", {
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 36,
      fill: THEME.gold,
      fontWeight: "bold",
    });
    finalScoreText.anchor.set(0.5);
    gameOverCont.addChild(finalScoreText);

    // ================================================================
    // Resize Handler
    // ================================================================

    const onResize = () => {
      const w = app.screen.width;
      const h = app.screen.height;
      const rotation = config.rotationDeg || 0;
      const isRotated = rotation === 90 || rotation === 270;

      // Center root container
      rootContainer.position.set(w / 2, h / 2);
      rootContainer.rotation = (rotation * Math.PI) / 180;

      // Calculate available space
      const screenW = isRotated ? h : w;
      const screenH = isRotated ? w : h;

      // Scale to fit (contain)
      const scaleX = screenW / MONITOR_W;
      const scaleY = screenH / MONITOR_H;
      const scale = Math.min(scaleX, scaleY);

      gameWorld.scale.set(scale);
      gameWorld.pivot.set(MONITOR_W / 2, MONITOR_H / 2);

      // Position UI elements
      const padding = 24;
      uiLayer.pivot.set(screenW / 2, screenH / 2);

      scoreText.position.set(screenW - padding, padding);
      timerText.position.set(padding, padding);
      monitorLabel.position.set(screenW / 2, padding);

      // Game over overlay
      gameOverCont.position.set(screenW / 2, screenH / 2);
      gameOverBg.clear();
      gameOverBg.beginFill(0x000000, 0.85);
      gameOverBg.drawRect(-screenW / 2, -screenH / 2, screenW, screenH);
      gameOverText.y = -50;
      finalScoreText.y = 50;
    };

    app.renderer.on("resize", onResize);
    onResize();

    // ================================================================
    // Entity Graphics
    // ================================================================

    const entityGraphics = new PIXI.Graphics();
    entityLayer.addChild(entityGraphics);

    // Draw snake segment with modern styling
    const drawSnakeSegment = (
      g: PIXI.Graphics,
      x: number,
      y: number,
      index: number,
      total: number,
      dir: string
    ) => {
      const isHead = index === 0;
      const isTail = index === total - 1;
      
      // Calculate segment appearance based on position
      const t = index / Math.max(1, total - 1);
      
      if (isHead) {
        // Head with glow effect
        g.beginFill(THEME.snakeHead);
        g.drawRoundedRect(
          x - CELL / 2 + 1,
          y - CELL / 2 + 1,
          CELL - 2,
          CELL - 2,
          8
        );
        g.endFill();

        // Eyes
        const eyeOffset = CELL * 0.25;
        let lx = x - eyeOffset,
          ly = y - eyeOffset;
        let rx = x + eyeOffset,
          ry = y - eyeOffset;

        if (dir === "down") {
          ly = y + eyeOffset;
          ry = y + eyeOffset;
        } else if (dir === "left") {
          lx = x - eyeOffset;
          ly = y - eyeOffset;
          rx = x - eyeOffset;
          ry = y + eyeOffset;
        } else if (dir === "right") {
          lx = x + eyeOffset;
          ly = y - eyeOffset;
          rx = x + eyeOffset;
          ry = y + eyeOffset;
        }

        // Eye whites
        g.beginFill(0xffffff);
        g.drawCircle(lx, ly, 5);
        g.drawCircle(rx, ry, 5);
        g.endFill();

        // Pupils
        g.beginFill(0x0f172a);
        g.drawCircle(lx, ly, 2);
        g.drawCircle(rx, ry, 2);
        g.endFill();
      } else {
        // Body segment with gradient effect
        const color = isTail ? THEME.snakeTail : index % 2 === 0 ? THEME.snakeBody : THEME.snakeBodyAlt;
        const size = lerp(CELL - 4, CELL - 8, t);
        const offset = (CELL - size) / 2;

        g.beginFill(color);
        g.drawRoundedRect(x - CELL / 2 + offset, y - CELL / 2 + offset, size, size, 4);
        g.endFill();
      }
    };

    // Draw food with pulsing animation
    const drawFood = (
      g: PIXI.Graphics,
      x: number,
      y: number,
      tick: number,
      index: number
    ) => {
      const pulse = 1 + Math.sin(tick * 3 + index * 0.5) * 0.15;
      const size = 10 * pulse;
      const color = index % 2 === 0 ? THEME.food : THEME.foodAlt;

      // Glow
      g.beginFill(color, 0.2);
      g.drawCircle(x, y, size + 8);
      g.endFill();

      // Main food circle
      g.beginFill(color);
      g.drawCircle(x, y, size);
      g.endFill();

      // Highlight
      g.beginFill(0xffffff, 0.4);
      g.drawCircle(x - 3, y - 3, size * 0.3);
      g.endFill();
    };

    // ================================================================
    // Render Loop
    // ================================================================

    let tick = 0;

    app.ticker.add(() => {
      tick += 0.02;

      // Animate portals
      portalContainers.forEach((pCont) => {
        const rings = pCont.children[0] as PIXI.Graphics;
        if (rings) {
          rings.clear();

          // Outer rings
          for (let i = 0; i < 3; i++) {
            const radius = 30 + i * 12 + Math.sin(tick * 2 + i) * 4;
            const alpha = 0.6 - i * 0.15;
            rings.lineStyle(2, THEME.portalOuter, alpha);
            rings.drawCircle(0, 0, radius);
          }

          // Inner core
          const coreSize = 18 + Math.sin(tick * 4) * 3;
          rings.beginFill(THEME.portalCore, 0.6);
          rings.drawCircle(0, 0, coreSize);
          rings.endFill();

          rings.beginFill(THEME.portalInner, 0.4);
          rings.drawCircle(0, 0, coreSize * 0.6);
          rings.endFill();
        }
      });

      // Get current state
      const s = stateRef.current;
      if (!s) return;

      // Update UI text
      scoreText.text = `Score: ${s.score}`;
      timerText.text = `Time: ${formatTime(s.timeLeftMs)}`;

      // Timer color based on remaining time
      if (s.timeLeftMs < 30000) {
        timerText.style.fill = THEME.danger;
      } else if (s.timeLeftMs < 60000) {
        timerText.style.fill = THEME.gold;
      } else {
        timerText.style.fill = THEME.text;
      }

      // Game over state
      if (s.phase === "ended") {
        gameOverCont.visible = true;
        finalScoreText.text = `Final Score: ${s.score}`;
      } else {
        gameOverCont.visible = false;
      }

      // Clear entity graphics
      entityGraphics.clear();

      // Calculate monitor origin
      const originX = config.col * MONITOR_W;
      const originY = config.row * MONITOR_H;

      // Draw food items
      s.foods
        .filter((f) => f.monitorId === monitorId)
        .forEach((f, idx) => {
          drawFood(entityGraphics, f.x - originX, f.y - originY, tick, idx);
        });

      // Draw snake segments
      s.snake.forEach((seg, idx) => {
        if (
          seg.x >= originX &&
          seg.x < originX + MONITOR_W &&
          seg.y >= originY &&
          seg.y < originY + MONITOR_H
        ) {
          drawSnakeSegment(
            entityGraphics,
            seg.x - originX,
            seg.y - originY,
            idx,
            s.snake.length,
            s.dir
          );
        }
      });
    });

    // Cleanup
    return () => {
      app.destroy(true, { children: true });
      appRef.current = null;
    };
  }, [config, monitorId, portals]);

  // Focus container on load
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [loading]);

  // ============================================================================
  // Render States
  // ============================================================================

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading monitor {monitorId}...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-900 p-4">
        <Card className="max-w-md bg-slate-800/80 border-slate-700/50">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
            <p className="text-slate-400 mb-4">
              {error || "Monitor not found in configuration"}
            </p>
            <Badge variant="secondary" className="font-mono">
              Monitor ID: {monitorId}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="w-screen h-screen overflow-hidden outline-none relative bg-slate-900"
    >
      {/* Start Game Overlay (only on monitor 0 when idle) */}
      {monitorId === "0" && isIdle && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md">
          <div className="text-center animate-in p-8">
            <div className="text-8xl mb-6">🐍</div>
            <h1 className="text-5xl font-bold text-white mb-4">Snake Game</h1>
            <p className="text-xl text-slate-400 mb-8">
              Use arrow keys to control the snake
            </p>
            <Button
              onClick={handleStartGame}
              variant="gradient"
              size="xl"
              className="gap-3 text-xl px-12 py-6"
            >
              <Play className="w-6 h-6" />
              Start Game
            </Button>
          </div>
        </div>
      )}

      {/* Mini Stats Overlay (bottom corners) */}
      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2">
        <Badge variant="secondary" className="font-mono">
          <Monitor className="w-3 h-3 mr-1" />
          M{monitorId}
        </Badge>
      </div>

      <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2">
        <Badge
          variant={
            stateRef.current?.timeLeftMs && stateRef.current.timeLeftMs < 30000
              ? "destructive"
              : "success"
          }
        >
          <Timer className="w-3 h-3 mr-1" />
          {formatTime(currentTime)}
        </Badge>
        <Badge variant="warning">
          <Trophy className="w-3 h-3 mr-1" />
          {currentScore}
        </Badge>
      </div>
    </div>
  );
}
