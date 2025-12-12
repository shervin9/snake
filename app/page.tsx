"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Monitor, 
  Gamepad2, 
  Settings, 
  Zap, 
  Users, 
  Trophy,
  ArrowRight,
  Play
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-6">
            <Zap className="w-4 h-4" />
            Multi-Monitor Gaming Experience
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="text-gradient">Snake</span>
            <span className="text-white"> Game</span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            A modern snake game that spans across multiple monitors. 
            Control the snake, collect food, and compete for high scores 
            in this immersive multi-screen experience.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/admin">
              <Button variant="gradient" size="xl" className="gap-2">
                <Play className="w-5 h-5" />
                Start Playing
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/monitor/0">
              <Button variant="outline" size="xl" className="gap-2">
                <Monitor className="w-5 h-5" />
                View Monitor
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          <Card className="bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/50 transition-all duration-300 group">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <Monitor className="w-6 h-6 text-emerald-400" />
              </div>
              <CardTitle className="text-white">Multi-Monitor Support</CardTitle>
              <CardDescription>
                Seamlessly play across up to 9 monitors with automatic portal creation and smooth transitions.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 group">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
                <Gamepad2 className="w-6 h-6 text-cyan-400" />
              </div>
              <CardTitle className="text-white">Smooth Controls</CardTitle>
              <CardDescription>
                Responsive keyboard controls with buffered input for precise movement and direction changes.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700/50 hover:border-amber-500/50 transition-all duration-300 group">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <CardTitle className="text-white">Score System</CardTitle>
              <CardDescription>
                Collect food items to increase your score. Each food is worth 10 points and makes your snake grow.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Quick Access</h2>
          
          <div className="grid sm:grid-cols-2 gap-4">
            <Link href="/admin" className="group">
              <Card className="bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/50 transition-all duration-300 h-full">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Settings className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Operator Panel</h3>
                    <p className="text-sm text-slate-400">Configure and control the game</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500 ml-auto group-hover:text-emerald-400 transition-colors" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/monitor/0" className="group">
              <Card className="bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 h-full">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                    <Monitor className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Game Monitor</h3>
                    <p className="text-sm text-slate-400">View the game board</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500 ml-auto group-hover:text-cyan-400 transition-colors" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Instructions */}
        <div className="max-w-3xl mx-auto mt-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">How to Play</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <kbd className="px-3 py-1 rounded bg-slate-700 text-white font-mono">↑</kbd>
              <p className="text-slate-400 mt-2">Move Up</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <kbd className="px-3 py-1 rounded bg-slate-700 text-white font-mono">↓</kbd>
              <p className="text-slate-400 mt-2">Move Down</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <kbd className="px-3 py-1 rounded bg-slate-700 text-white font-mono">←</kbd>
              <p className="text-slate-400 mt-2">Move Left</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <kbd className="px-3 py-1 rounded bg-slate-700 text-white font-mono">→</kbd>
              <p className="text-slate-400 mt-2">Move Right</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-slate-500 text-sm">
        <p>Built with Next.js, Pixi.js, and Tailwind CSS</p>
      </footer>
    </main>
  );
}






