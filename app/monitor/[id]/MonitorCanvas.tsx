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
  // Background - different for horizontal and vertical monitors
  bgHorizontal: 0x0f4135, // سبز تیره برای مانیتورهای افقی
  bgVertical: 0x710013,   // قرمز برای مانیتورهای عمودی
  bg: 0x0f4135, // default fallback (green)
  bgGradientStart: 0x1a5a4a, // lighter green
  bgGradientEnd: 0x0f4135, // dark green

  // Grid
  grid: 0xffffff, // white for visibility
  gridStrong: 0xffffff, // white
  gridAccent: 0xffffff, // white accent

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

// Convert numbers to Persian digits
function toPersianNum(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/[0-9]/g, (d) => persianDigits[parseInt(d)]);
}

function formatTime(ms: number): string {
  if (!ms || ms <= 0) return "۰:۰۰";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return toPersianNum(`${minutes}:${seconds.toString().padStart(2, "0")}`);
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
  
  // Interpolation state for smooth movement
  const interpolatedSnakeRef = useRef<{ x: number; y: number }[]>([]);
  const lastStateUpdateRef = useRef<number>(Date.now());
  const targetSnakeRef = useRef<{ x: number; y: number }[]>([]);

  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [isIdle, setIsIdle] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Track tab visibility to pause polling/rendering when hidden (saves resources)
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

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

  // Use Server-Sent Events (SSE) for real-time state updates
  // Much more efficient than polling - server pushes updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let isConnecting = false;
    
    const connect = () => {
      // Skip if tab is hidden
      if (!isTabVisible) return;
      if (isConnecting) return;
      
      isConnecting = true;
      eventSource = new EventSource('/api/state/stream');
      
      eventSource.onopen = () => {
        isConnecting = false;
        console.log(`[Monitor ${monitorId}] SSE connected`);
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          prevStateRef.current = stateRef.current;
          stateRef.current = data.state;
          
          // Update interpolation targets when new state arrives
          if (data.state?.snake) {
            targetSnakeRef.current = data.state.snake.map((seg: { x: number; y: number }) => ({ x: seg.x, y: seg.y }));
            lastStateUpdateRef.current = Date.now();
            
            // Initialize interpolated snake if empty
            if (interpolatedSnakeRef.current.length === 0) {
              interpolatedSnakeRef.current = targetSnakeRef.current.map(seg => ({ ...seg }));
            }
          }
          setIsIdle(data.state?.phase === "idle");
          setIsEnded(data.state?.phase === "ended");
          setCurrentScore(data.state?.score ?? 0);
          setCurrentTime(data.state?.timeLeftMs ?? 0);
        } catch (err) {
          // Silent fail for parse errors
        }
      };
      
      eventSource.onerror = () => {
        isConnecting = false;
        eventSource?.close();
        eventSource = null;
        
        // Reconnect after 1 second
        reconnectTimeout = setTimeout(connect, 1000);
      };
    };
    
    connect();
    
    return () => {
      clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [monitorId, isTabVisible]);

  // Keyboard input for snake direction
  // تبدیل جهت بر اساس مانیتوری که مار الان توشه (activeMonitorId)
  useEffect(() => {
    const sendInput = async (direction: "up" | "down" | "left" | "right") => {
      // Only send input if game is running
      if (stateRef.current?.phase !== "running") return;
      
      // Get the monitor that the snake is currently on
      const activeMonitor = stateRef.current?.activeMonitorId || "0";
      
      // Check if snake is on a vertical monitor (1, 3, 5)
      const isOnVerticalMonitor = ["1", "3", "5"].includes(activeMonitor);
      
      let finalDir = direction;
      
      // Transform direction if snake is on a vertical monitor
      // This makes controls intuitive relative to that monitor's orientation
      if (isOnVerticalMonitor) {
        const map: Record<string, "up" | "down" | "left" | "right"> = {
          up: "left",
          down: "right",
          left: "down",
          right: "up"
        };
        finalDir = map[direction];
      }
      
      try {
        await fetch("/api/state/input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction: finalDir }),
        });
      } catch (err) {
        console.error("Failed to send input:", err);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        const dir = e.key.replace("Arrow", "").toLowerCase() as "up" | "down" | "left" | "right";
        sendInput(dir);
      }
    };

    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, []);

  // Start game handler
  const handleStartGame = useCallback(async () => {
    console.log("Starting game...");
    try {
      const res = await fetch("/api/state/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      console.log("Start game response:", data);
      if (data.state) {
        stateRef.current = data.state;
        setIsIdle(data.state.phase === "idle");
        setIsEnded(data.state.phase === "ended");
      }
    } catch (err) {
      console.error("Failed to start game:", err);
    }
  }, []);

  // Reset game handler
  const handleResetGame = useCallback(async () => {
    console.log("Resetting game...");
    try {
      const res = await fetch("/api/state/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      console.log("Reset game response:", data);
      if (data.state) {
        stateRef.current = data.state;
        setIsIdle(data.state.phase === "idle");
        setIsEnded(data.state.phase === "ended");
      }
    } catch (err) {
      console.error("Failed to reset game:", err);
    }
  }, []);

  // Keyboard to start game (any key on monitor 0 when idle)
  useEffect(() => {
    if (monitorId !== "0") return;
    
    const handleKeyToStart = (e: KeyboardEvent) => {
      // Only start if game is idle
      if (stateRef.current?.phase !== "idle" && !isIdle) return;
      
      // Start on Space, Enter, or any Arrow key
      if (e.key === " " || e.key === "Enter" || e.key.startsWith("Arrow")) {
        e.preventDefault();
        console.log("Starting game via keyboard:", e.key);
        handleStartGame();
      }
    };

    window.addEventListener("keydown", handleKeyToStart);
    return () => window.removeEventListener("keydown", handleKeyToStart);
  }, [monitorId, isIdle, handleStartGame]);

  // PIXI.js setup and render loop
  useEffect(() => {
    if (!containerRef.current || !config) return;

    // Create PIXI Application with optimized settings
    // Cap resolution at 1.5 for better performance on high-DPI displays
    const maxResolution = 1.5;
    const deviceRatio = window.devicePixelRatio || 1;
    const resolution = Math.min(deviceRatio, maxResolution);
    
    // Choose background color based on monitor type
    const isVerticalMonitor = ["1", "3", "5"].includes(monitorId);
    const bgColor = isVerticalMonitor ? THEME.bgVertical : THEME.bgHorizontal;
    
    const app = new PIXI.Application({
      resizeTo: containerRef.current,
      backgroundColor: bgColor,
      antialias: resolution >= 1.5, // Only enable antialiasing on higher resolution
      autoDensity: true,
      resolution,
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

      // Choose background color based on monitor type
      // Vertical monitors (1, 3, 5): red/maroon
      // Horizontal monitors (0, 2, 4): green
      const isVerticalMonitor = ["1", "3", "5"].includes(monitorId);
      const bgColor = isVerticalMonitor ? THEME.bgVertical : THEME.bgHorizontal;

      // Main background
      const bg = new PIXI.Graphics();
      bg.beginFill(bgColor);
      bg.drawRect(0, 0, MONITOR_W, MONITOR_H);
      bg.endFill();
      bgLayer.addChild(bg);

      // Subtle grid dots pattern (optimized: single Graphics object, wider spacing)
      const dots = new PIXI.Graphics();
      dots.beginFill(0xffffff, 0.1);
      for (let x = CELL; x < MONITOR_W; x += CELL * 4) {
        for (let y = CELL; y < MONITOR_H; y += CELL * 4) {
          dots.drawCircle(x, y, 1);
        }
      }
      dots.endFill();
      bgLayer.addChild(dots);
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

        // Portal graphics (will be animated)
        const portalGraphics = new PIXI.Graphics();
        pCont.addChild(portalGraphics);

        // Portal label removed - no text above portals

        portalContainers.set(`portal-${idx}`, pCont);
        portalLayer.addChild(pCont);
      });
    };
    setupPortals();

    // ================================================================
    // UI Elements
    // ================================================================

    // Score display (top-right for RTL)
    const scoreText = new PIXI.Text("امتیاز: ۰", {
      fontFamily: "Vazirmatn, system-ui, sans-serif",
      fontSize: 28,
      fill: THEME.gold,
      fontWeight: "bold",
    });
    scoreText.anchor.set(1, 0); // Anchor right edge
    uiLayer.addChild(scoreText);

    // Timer display (top-left for RTL)
    const timerText = new PIXI.Text("زمان: ۰:۰۰", {
      fontFamily: "Vazirmatn, system-ui, sans-serif",
      fontSize: 28,
      fill: THEME.text,
      fontWeight: "bold",
    });
    timerText.anchor.set(0, 0); // Anchor left edge
    uiLayer.addChild(timerText);

    // Monitor label
    const monitorLabel = new PIXI.Text(`مانیتور ${monitorId}`, {
      fontFamily: "Vazirmatn, system-ui, sans-serif",
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

    const gameOverText = new PIXI.Text("پایان بازی", {
      fontFamily: "Vazirmatn, system-ui, sans-serif",
      fontSize: 72,
      fill: THEME.danger,
      fontWeight: "900",
    });
    gameOverText.anchor.set(0.5);
    gameOverCont.addChild(gameOverText);

    const finalScoreText = new PIXI.Text("", {
      fontFamily: "Vazirmatn, system-ui, sans-serif",
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

      // Scale to fit (contain) - entire game visible, maintains aspect ratio
      let scale: number;
      
      if (isRotated) {
        // For rotated monitors: swap dimensions
        const scaleX = h / MONITOR_W;
        const scaleY = w / MONITOR_H;
        scale = Math.min(scaleX, scaleY); // Use min for contain (all visible)
      } else {
        // Normal landscape mode
        const scaleX = w / MONITOR_W;
        const scaleY = h / MONITOR_H;
        scale = Math.min(scaleX, scaleY); // Use min for contain (all visible)
      }

      gameWorld.scale.set(scale);
      gameWorld.pivot.set(MONITOR_W / 2, MONITOR_H / 2);

      // Position UI elements (always use actual screen dimensions)
      const padding = 24;
      uiLayer.pivot.set(w / 2, h / 2);

      // Score on right, timer on left (RTL layout)
      scoreText.position.set(w - padding, padding);
      timerText.position.set(padding, padding);
      monitorLabel.position.set(w / 2, h - padding - 40);

      // Game over overlay
      gameOverCont.position.set(w / 2, h / 2);
      gameOverBg.clear();
      gameOverBg.beginFill(0x000000, 0.85);
      gameOverBg.drawRect(-w / 2, -h / 2, w, h);
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

    // Draw snake segment with optimized styling (uses rects instead of rounded rects for performance)
    const drawSnakeSegment = (
      g: PIXI.Graphics,
      x: number,
      y: number,
      index: number,
      total: number,
      dir: string
    ) => {
      const isHead = index === 0;
      
      if (isHead) {
        // Head - simple filled rectangle
        g.beginFill(THEME.snakeHead);
        g.drawRect(x - CELL / 2 + 1, y - CELL / 2 + 1, CELL - 2, CELL - 2);
        g.endFill();

        // Eyes (simplified - just two white dots)
        const eyeOffset = CELL * 0.25;
        let lx = x - eyeOffset, ly = y - eyeOffset;
        let rx = x + eyeOffset, ry = y - eyeOffset;

        if (dir === "down") { ly = y + eyeOffset; ry = y + eyeOffset; }
        else if (dir === "left") { lx = x - eyeOffset; ly = y - eyeOffset; rx = x - eyeOffset; ry = y + eyeOffset; }
        else if (dir === "right") { lx = x + eyeOffset; ly = y - eyeOffset; rx = x + eyeOffset; ry = y + eyeOffset; }

        g.beginFill(0xffffff);
        g.drawCircle(lx, ly, 4);
        g.drawCircle(rx, ry, 4);
        g.endFill();
      } else {
        // Body segment - alternating colors, simple rectangles
        const color = index % 2 === 0 ? THEME.snakeBody : THEME.snakeBodyAlt;
        const margin = 2;
        g.beginFill(color);
        g.drawRect(x - CELL / 2 + margin, y - CELL / 2 + margin, CELL - margin * 2, CELL - margin * 2);
        g.endFill();
      }
    };

    // Draw food with simplified animation (optimized for performance)
    const drawFood = (
      g: PIXI.Graphics,
      x: number,
      y: number,
      tick: number,
      index: number
    ) => {
      const pulse = 1 + Math.sin(tick * 2 + index) * 0.1;
      const size = 10 * pulse;
      const color = index % 2 === 0 ? THEME.food : THEME.foodAlt;

      // Single circle for food (no glow/highlight for performance)
      g.beginFill(color);
      g.drawCircle(x, y, size);
      g.endFill();
    };

    // ================================================================
    // Render Loop
    // ================================================================

    let tick = 0;

    let frameCount = 0;
    
    app.ticker.add(() => {
      tick += 0.02;
      frameCount++;
      
      // Get current game phase for optimizations
      const currentPhase = stateRef.current?.phase;
      const isGameActive = currentPhase === "running";
      
      // Skip portal animation every other frame when game is not active (saves GPU)
      const shouldAnimatePortals = isGameActive || frameCount % 2 === 0;

      // Animate portals with clean circular design (simplified when idle)
      if (shouldAnimatePortals) {
        portalContainers.forEach((pCont) => {
          const g = pCont.children[0] as PIXI.Graphics;
          if (g) {
            g.clear();
            
            // Outer glow ring
            const glowRadius = 55 + Math.sin(tick * 2) * 5;
            g.beginFill(THEME.portalOuter, 0.15);
            g.drawCircle(0, 0, glowRadius);
            g.endFill();
            
            // Main portal rings (fewer when idle)
            const ringCount = isGameActive ? 3 : 2;
            for (let i = 0; i < ringCount; i++) {
              const radius = 35 + i * 10 + Math.sin(tick * 2.5 + i * 0.7) * 3;
              const alpha = 0.7 - i * 0.15;
              const lineWidth = 3 - i * 0.5;
              g.lineStyle(lineWidth, THEME.portalOuter, alpha);
              g.drawCircle(0, 0, radius);
            }
            
            // Inner core with gradient effect
            const coreSize = 25 + Math.sin(tick * 4) * 4;
            g.beginFill(THEME.portalCore, 0.5);
            g.drawCircle(0, 0, coreSize);
            g.endFill();
            
            // Bright center
            g.beginFill(THEME.portalInner, 0.6);
            g.drawCircle(0, 0, coreSize * 0.5);
            g.endFill();
            
            // Rotating particles (fewer when idle, skip entirely when ended)
            const particleCount = isGameActive ? 6 : (currentPhase === "idle" ? 3 : 0);
            for (let i = 0; i < particleCount; i++) {
              const angle = tick * 1.5 + i * (Math.PI * 2 / particleCount);
              const dist = 45 + Math.sin(tick * 3 + i) * 5;
              const px = Math.cos(angle) * dist;
              const py = Math.sin(angle) * dist;
              const particleSize = 4 + Math.sin(tick * 4 + i * 2) * 2;
              
              g.beginFill(THEME.portalInner, 0.7);
              g.drawCircle(px, py, particleSize);
              g.endFill();
            }
          }
        });
      }

      // Get current state
      const s = stateRef.current;
      if (!s) return;

      // Update UI text
      scoreText.text = `امتیاز: ${toPersianNum(s.score)}`;
      timerText.text = `زمان: ${formatTime(s.timeLeftMs)}`;

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
        finalScoreText.text = `امتیاز نهایی: ${toPersianNum(s.score)}`;
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

      // Interpolate snake towards target positions for smooth movement
      // Time-based interpolation for consistent smoothness regardless of frame rate
      const now = Date.now();
      const timeSinceUpdate = now - lastStateUpdateRef.current;
      const UPDATE_INTERVAL = 60; // Match SSE update interval
      
      // Calculate lerp factor based on time - complete interpolation before next update
      // Use easing for smoother movement
      const rawProgress = Math.min(timeSinceUpdate / UPDATE_INTERVAL, 1);
      const INTERPOLATION_SPEED = easeOutQuad(rawProgress) * 0.4 + 0.1; // Range 0.1-0.5 with easing
      
      const targetSnake = targetSnakeRef.current;
      const interpolatedSnake = interpolatedSnakeRef.current;
      
      // Use server snake directly if interpolation not ready
      const snakeToRender = (targetSnake.length > 0 && interpolatedSnake.length > 0) 
        ? interpolatedSnake 
        : s.snake;
      
      // Only interpolate if we have valid targets
      if (targetSnake.length > 0) {
        // Adjust interpolated snake length to match target
        while (interpolatedSnake.length < targetSnake.length) {
          const lastSeg = interpolatedSnake[interpolatedSnake.length - 1] || targetSnake[interpolatedSnake.length];
          interpolatedSnake.push({ x: lastSeg.x, y: lastSeg.y });
        }
        while (interpolatedSnake.length > targetSnake.length && interpolatedSnake.length > 0) {
          interpolatedSnake.pop();
        }
        
        // Smoothly interpolate each segment towards target with time-based factor
        for (let i = 0; i < interpolatedSnake.length && i < targetSnake.length; i++) {
          const dx = targetSnake[i].x - interpolatedSnake[i].x;
          const dy = targetSnake[i].y - interpolatedSnake[i].y;
          
          // Snap to target if very close (avoid jitter)
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            interpolatedSnake[i].x = targetSnake[i].x;
            interpolatedSnake[i].y = targetSnake[i].y;
          } else {
            interpolatedSnake[i].x = lerp(interpolatedSnake[i].x, targetSnake[i].x, INTERPOLATION_SPEED);
            interpolatedSnake[i].y = lerp(interpolatedSnake[i].y, targetSnake[i].y, INTERPOLATION_SPEED);
          }
        }
      }
      
      // Draw snake segments
      snakeToRender.forEach((seg, idx) => {
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
            interpolatedSnake.length,
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

  // Pause/resume PIXI ticker based on tab visibility (saves CPU/GPU)
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    
    if (isTabVisible) {
      app.ticker.start();
    } else {
      app.ticker.stop();
    }
  }, [isTabVisible]);

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
    const isVerticalMonitor = ["1", "3", "5"].includes(monitorId);
    return (
      <div 
        className="w-screen h-screen flex items-center justify-center"
        style={{ backgroundColor: isVerticalMonitor ? '#710013' : '#0f4135' }}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    const isVerticalMonitor = ["1", "3", "5"].includes(monitorId);
    return (
      <div 
        className="w-screen h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: isVerticalMonitor ? '#710013' : '#0f4135' }}
      >
        <Card className="max-w-md bg-black/30 border-white/20">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
            <p className="text-white/70 mb-4">
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

  // Main container - color is handled by PIXI canvas
  const isVerticalMonitor = ["1", "3", "5"].includes(monitorId);
  
  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="w-screen h-screen overflow-hidden outline-none relative"
      style={{ backgroundColor: isVerticalMonitor ? '#710013' : '#0f4135' }}
    >
      {/* Start Game Overlay (only on monitor 0 when idle) */}
      {monitorId === "0" && isIdle && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md cursor-pointer"
          style={{ backgroundColor: 'rgba(15, 65, 53, 0.95)' }}
          onClick={handleStartGame}
        >
          <div className="text-center animate-in p-8 max-w-2xl">
            <div className="text-9xl mb-8 animate-bounce">🐍</div>
            <h1 className="text-6xl font-bold text-white mb-4">Snake Clash</h1>
            <p className="text-2xl text-emerald-200 mb-12">
              برای شروع کلیک کنید یا کلیدی را فشار دهید
            </p>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleStartGame();
              }}
              variant="gradient"
              size="xl"
              className="gap-4 text-2xl px-16 py-8 shadow-2xl bg-emerald-600 hover:bg-emerald-500 transition-all"
            >
              <Play className="w-8 h-8" />
              شروع بازی
            </Button>
            <p className="text-lg text-emerald-300 mt-8">
              از کلیدهای ↑ ↓ ← → برای کنترل مار استفاده کنید
            </p>
          </div>
        </div>
      )}

      {/* Waiting Overlay (other monitors when idle) - color based on monitor type */}
      {monitorId !== "0" && isIdle && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md"
          style={{ 
            backgroundColor: ["1", "3", "5"].includes(monitorId) 
              ? 'rgba(113, 0, 19, 0.95)' 
              : 'rgba(15, 65, 53, 0.95)' 
          }}
        >
          <div className="text-center animate-in p-8">
            <div className="text-8xl mb-6 opacity-70">🐍</div>
            <h1 className="text-4xl font-bold text-white mb-4">Snake Clash</h1>
            <p className="text-xl text-white/70">
              در انتظار شروع بازی...
            </p>
            <div className="mt-8 flex items-center justify-center gap-2">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-white/60">متصل</span>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay (on monitor 0 when ended) */}
      {monitorId === "0" && isEnded && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md"
          style={{ backgroundColor: 'rgba(113, 0, 19, 0.95)' }}
        >
          <div className="text-center animate-in p-8 max-w-2xl">
            <div className="text-9xl mb-8">💀</div>
            <h1 className="text-6xl font-bold text-white mb-4">پایان بازی</h1>
            <p className="text-4xl text-amber-300 mb-8">
              امتیاز نهایی: {currentScore}
            </p>
            <Button
              onClick={handleResetGame}
              variant="gradient"
              size="xl"
              className="gap-4 text-2xl px-16 py-8 shadow-2xl bg-emerald-600 hover:bg-emerald-500 transition-all"
            >
              <Play className="w-8 h-8" />
              بازی مجدد
            </Button>
          </div>
        </div>
      )}

      {/* Game Over Overlay (other monitors when ended) */}
      {monitorId !== "0" && isEnded && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md"
          style={{ 
            backgroundColor: ["1", "3", "5"].includes(monitorId) 
              ? 'rgba(113, 0, 19, 0.95)' 
              : 'rgba(15, 65, 53, 0.95)' 
          }}
        >
          <div className="text-center animate-in p-8">
            <div className="text-8xl mb-6">💀</div>
            <h1 className="text-4xl font-bold text-white mb-4">پایان بازی</h1>
            <p className="text-2xl text-amber-300">
              امتیاز نهایی: {currentScore}
            </p>
            <p className="text-lg text-white/60 mt-8">
              برای بازی مجدد به مانیتور ۰ بروید
            </p>
          </div>
        </div>
      )}

      {/* Mini Stats Overlay (bottom corners) - increased padding to avoid cutoff */}
      <div className="absolute bottom-8 left-8 z-40 flex items-center gap-2">
        <Badge variant="secondary" className="font-mono">
          <Monitor className="w-3 h-3 mr-1" />
          M{monitorId}
        </Badge>
      </div>

      <div className="absolute bottom-8 right-8 z-40 flex items-center gap-2">
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
