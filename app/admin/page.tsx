"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatTime } from "@/lib/utils";
import {
  Play,
  Pause,
  RotateCcw,
  Settings,
  Monitor,
  Timer,
  Trophy,
  Zap,
  ArrowLeft,
  Keyboard,
  Apple,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

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

type GameConfig = {
  monitorCount: number;
  timerSeconds: number;
  foodPerMonitor: number;
};

type Monitor = {
  id: string;
  row: number;
  col: number;
};

// ============================================================================
// Component
// ============================================================================

export default function AdminPage() {
  // State
  const [state, setState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig>({
    monitorCount: 6,
    timerSeconds: 120,
    foodPerMonitor: 5,
  });
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(true);

  // Computed values
  const timeProgress = useMemo(() => {
    if (!state) return 100;
    return (state.timeLeftMs / state.totalTimeMs) * 100;
  }, [state]);

  const timeVariant = useMemo(() => {
    if (!state) return "success";
    const percent = (state.timeLeftMs / state.totalTimeMs) * 100;
    if (percent > 50) return "success";
    if (percent > 20) return "warning";
    return "danger";
  }, [state]);

  // Poll server state
  useEffect(() => {
    if (setupMode) return;

    const fetchState = async () => {
      try {
        const res = await fetch("/api/state");
        const data = await res.json();
        setState(data.state);
        if (data.config) setConfig(data.config);
      } catch (err) {
        console.error("Error fetching state:", err);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 80);

    return () => clearInterval(interval);
  }, [setupMode]);

  // Fetch monitors
  useEffect(() => {
    if (setupMode) return;

    fetch("/api/monitors")
      .then((r) => r.json())
      .then((res) => setMonitors(res.monitors))
      .catch(console.error);
  }, [setupMode]);

  // Keyboard controls
  useEffect(() => {
    const sendInput = async (direction: "up" | "down" | "left" | "right") => {
      try {
        await fetch("/api/state/input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction }),
        });
      } catch (err) {
        console.error("Error sending input:", err);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") sendInput("up");
      else if (e.key === "ArrowDown") sendInput("down");
      else if (e.key === "ArrowLeft") sendInput("left");
      else if (e.key === "ArrowRight") sendInput("right");
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Handlers
  const handleSetup = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/state/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setup",
          monitorCount: config.monitorCount,
          timerSeconds: config.timerSeconds,
          foodPerMonitor: config.foodPerMonitor,
        }),
      });
      const data = await res.json();
      if (data.monitors) {
        setMonitors(data.monitors);
      }
      setSetupMode(false);
    } catch (err) {
      console.error("Setup error:", err);
    }
    setIsLoading(false);
  }, [config]);

  const handleStart = useCallback(async () => {
    try {
      const res = await fetch("/api/state/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await res.json();
      setState(data.state);
    } catch (err) {
      console.error("Start error:", err);
    }
  }, []);

  const handleStop = useCallback(async () => {
    try {
      const res = await fetch("/api/state/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const data = await res.json();
      setState(data.state);
    } catch (err) {
      console.error("Stop error:", err);
    }
  }, []);

  const handleReset = useCallback(async () => {
    try {
      const res = await fetch("/api/state/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      setState(data.state);
    } catch (err) {
      console.error("Reset error:", err);
    }
  }, []);

  // ============================================================================
  // Setup Mode UI
  // ============================================================================

  if (setupMode) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <Card className="w-full max-w-lg bg-slate-800/80 border-slate-700/50 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/25">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-white">
              Snake Game Setup
            </CardTitle>
            <p className="text-slate-400 mt-2">
              Configure your game settings before starting
            </p>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {/* Monitor Count */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Monitor className="w-4 h-4 text-emerald-400" />
                Number of Monitors
              </label>
              <Select
                value={String(config.monitorCount)}
                onChange={(e) =>
                  setConfig({ ...config, monitorCount: Number(e.target.value) })
                }
                className="bg-slate-900/50"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>
                    {n} Monitor{n > 1 ? "s" : ""}
                  </option>
                ))}
              </Select>
            </div>

            {/* Timer */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Timer className="w-4 h-4 text-cyan-400" />
                Game Duration (seconds)
              </label>
              <Input
                type="number"
                value={config.timerSeconds}
                onChange={(e) =>
                  setConfig({ ...config, timerSeconds: Number(e.target.value) })
                }
                min={30}
                max={600}
                className="bg-slate-900/50"
              />
            </div>

            {/* Food per Monitor */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Apple className="w-4 h-4 text-rose-400" />
                Food Items per Monitor
              </label>
              <Input
                type="number"
                value={config.foodPerMonitor}
                onChange={(e) =>
                  setConfig({ ...config, foodPerMonitor: Number(e.target.value) })
                }
                min={1}
                max={20}
                className="bg-slate-900/50"
              />
            </div>

            {/* Start Button */}
            <Button
              onClick={handleSetup}
              disabled={isLoading}
              variant="gradient"
              size="xl"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Initialize Game
                </>
              )}
            </Button>

            {/* Back link */}
            <Link href="/" className="block">
              <Button variant="ghost" className="w-full text-slate-400">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ============================================================================
  // Game Control UI
  // ============================================================================

  return (
    <main className="min-h-screen p-4 md:p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              Operator Panel
            </h1>
            <p className="text-slate-400 mt-1">
              Control and monitor your snake game
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={
                state?.phase === "running"
                  ? "success"
                  : state?.phase === "ended"
                  ? "destructive"
                  : "secondary"
              }
              className="text-sm px-3 py-1"
            >
              {state?.phase === "running"
                ? "Running"
                : state?.phase === "ended"
                ? "Game Over"
                : "Ready"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSetupMode(true)}
              className="text-slate-400"
            >
              <Settings className="w-4 h-4 mr-2" />
              New Setup
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Score */}
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Score</p>
                <p className="text-2xl font-bold text-amber-400">
                  {state?.score ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Timer */}
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Timer className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-400">Time Left</p>
                <p
                  className={cn(
                    "text-2xl font-bold font-mono",
                    timeVariant === "danger"
                      ? "text-rose-400"
                      : timeVariant === "warning"
                      ? "text-amber-400"
                      : "text-cyan-400"
                  )}
                >
                  {formatTime(state?.timeLeftMs ?? config.timerSeconds * 1000)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Snake Length */}
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Snake Length</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {state?.snake?.length ?? 2}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Direction */}
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Keyboard className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Direction</p>
                <p className="text-2xl font-bold text-purple-400 capitalize">
                  {state?.dir ?? "right"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Time Progress */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Time Progress</span>
              <span className="text-sm text-slate-400">
                {Math.round(timeProgress)}%
              </span>
            </div>
            <Progress value={timeProgress} variant={timeVariant} className="h-3" />
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              Game Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleStart}
                disabled={state?.phase === "running"}
                variant="success"
                size="lg"
                className="flex-1 min-w-[140px]"
              >
                <Play className="w-5 h-5 mr-2" />
                Start
              </Button>
              <Button
                onClick={handleStop}
                disabled={state?.phase !== "running"}
                variant="destructive"
                size="lg"
                className="flex-1 min-w-[140px]"
              >
                <Pause className="w-5 h-5 mr-2" />
                Stop
              </Button>
              <Button
                onClick={handleReset}
                variant="warning"
                size="lg"
                className="flex-1 min-w-[140px]"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Reset
              </Button>
            </div>
            <p className="text-sm text-slate-500 mt-4 text-center">
              Use arrow keys (↑ ↓ ← →) to control the snake
            </p>
          </CardContent>
        </Card>

        {/* Monitor Grid */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Monitor className="w-5 h-5 text-emerald-400" />
              Monitor Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.ceil(
                  Math.sqrt(monitors.length)
                )}, 1fr)`,
              }}
            >
              {monitors.map((m) => {
                const isActive = state?.activeMonitorId === m.id;
                const foodCount =
                  state?.foods?.filter((f) => f.monitorId === m.id).length ?? 0;

                return (
                  <Link key={m.id} href={`/monitor/${m.id}`}>
                    <div
                      className={cn(
                        "monitor-preview p-4 cursor-pointer",
                        isActive && "active"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-white">
                          Monitor {m.id}
                        </span>
                        {isActive && (
                          <span className="text-2xl animate-pulse">🐍</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Badge
                          variant={isActive ? "success" : "secondary"}
                          className="text-xs"
                        >
                          {isActive ? "Active" : "Idle"}
                        </Badge>
                        <Badge
                          variant="info"
                          className="text-xs flex items-center gap-1"
                        >
                          <Apple className="w-3 h-3" />
                          {foodCount}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-500 mt-2">
                        Row {m.row + 1}, Col {m.col + 1}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
