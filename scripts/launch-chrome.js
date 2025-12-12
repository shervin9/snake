#!/usr/bin/env node
/**
 * Multi-Monitor Chrome Launcher
 * 
 * Launches Chrome/Chromium windows in kiosk mode for each monitor.
 * Each window opens at the correct position and size for its assigned display.
 *
 * Usage:
 *   node scripts/launch-chrome.js --url http://localhost:3000/monitor
 *   node scripts/launch-chrome.js --count 4 --url http://localhost:3000/monitor
 *
 * Options:
 *   --url      Base URL for monitor pages (default: http://localhost:3000/monitor)
 *   --count    Number of monitors (default: reads from API or config)
 *   --delay    Delay between window launches in ms (default: 500)
 *   --no-kiosk Disable kiosk mode for debugging
 */

import { execSync, spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.replace(`--${name}=`, "") : defaultValue;
};
const hasFlag = (name) => args.includes(`--${name}`);

const baseUrl = getArg("url", "http://localhost:3000/monitor");
const monitorCount = parseInt(getArg("count", "0"));
const launchDelay = parseInt(getArg("delay", "500"));
const kioskMode = !hasFlag("no-kiosk");

// Monitor dimensions
const MONITOR_W = 1920;
const MONITOR_H = 1080;

/**
 * Find Chrome/Chromium binary path
 */
function findChromeBinary() {
  const candidates = [
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    // Linux
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    // Windows (common paths)
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    // Generic
    "chrome",
  ];

  for (const bin of candidates) {
    try {
      // Check if it's an absolute path that exists
      if (bin.includes("/") || bin.includes("\\")) {
        if (existsSync(bin)) {
          return bin;
        }
        continue;
      }
      // Check if it's in PATH
      execSync(`command -v "${bin}"`, { stdio: "ignore" });
      return bin;
    } catch {
      continue;
    }
  }

  console.error("❌ Chrome/Chromium not found.");
  console.error("Please install Chrome or specify the binary path.");
  process.exit(1);
}

/**
 * Generate monitor configurations
 */
function generateMonitors(count) {
  const monitors = [];
  const cols = Math.ceil(Math.sqrt(count));

  let id = 0;
  let row = 0;
  let col = 0;

  while (id < count) {
    monitors.push({
      id: String(id),
      row,
      col,
      rotationDeg: 0,
    });
    col++;
    if (col >= cols) {
      col = 0;
      row++;
    }
    id++;
  }

  return monitors;
}

/**
 * Load monitors from config file or generate
 */
function loadMonitors(count) {
  const configPath = path.join(process.cwd(), "config", "monitors.json");

  if (count > 0) {
    console.log(`📺 Generating ${count} monitors...`);
    return generateMonitors(count);
  }

  if (existsSync(configPath)) {
    try {
      const data = readFileSync(configPath, "utf-8");
      const monitors = JSON.parse(data);
      console.log(`📺 Loaded ${monitors.length} monitors from config`);
      return monitors;
    } catch (err) {
      console.warn("⚠️ Failed to parse monitors.json:", err.message);
    }
  }

  // Default to 6 monitors
  console.log("📺 Using default 6 monitor configuration");
  return generateMonitors(6);
}

/**
 * Launch a Chrome window
 */
function launchWindow(chromeBin, monitor, index) {
  const url = `${baseUrl}/${monitor.id}`;
  const isRotated = monitor.rotationDeg === 90 || monitor.rotationDeg === 270;
  const width = isRotated ? MONITOR_H : MONITOR_W;
  const height = isRotated ? MONITOR_W : MONITOR_H;

  // Position windows in a grid (scaled down for desktop testing)
  const scale = 0.5;
  const posX = monitor.col * width * scale + 50;
  const posY = monitor.row * height * scale + 50;

  const chromeArgs = [
    `--app=${url}`,
    "--new-window",
    `--window-size=${Math.round(width * scale)},${Math.round(height * scale)}`,
    `--window-position=${Math.round(posX)},${Math.round(posY)}`,
    "--disable-translate",
    "--disable-extensions",
    "--disable-sync",
    "--no-first-run",
    "--incognito",
  ];

  if (kioskMode) {
    chromeArgs.push("--kiosk");
  }

  console.log(`🖥️  Monitor ${monitor.id} (Row ${monitor.row}, Col ${monitor.col})`);
  console.log(`   URL: ${url}`);
  console.log(`   Size: ${width}x${height}${monitor.rotationDeg ? ` (rotated ${monitor.rotationDeg}°)` : ""}`);

  const proc = spawn(chromeBin, chromeArgs, {
    stdio: "ignore",
    detached: true,
  });

  proc.unref();
  return proc;
}

/**
 * Main execution
 */
async function main() {
  console.log("🐍 Snake Game - Multi-Monitor Launcher");
  console.log("======================================\n");

  const chromeBin = findChromeBinary();
  console.log(`🌐 Chrome: ${chromeBin}`);
  console.log(`🔗 Base URL: ${baseUrl}`);
  console.log(`⚙️  Kiosk mode: ${kioskMode ? "enabled" : "disabled"}\n`);

  const monitors = loadMonitors(monitorCount);
  console.log(`\n📺 Launching ${monitors.length} windows...\n`);

  for (let i = 0; i < monitors.length; i++) {
    launchWindow(chromeBin, monitors[i], i);

    // Add delay between launches to prevent race conditions
    if (i < monitors.length - 1 && launchDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, launchDelay));
    }
  }

  console.log("\n✅ All windows launched!");
  console.log("\n📋 Instructions:");
  console.log("   1. Open the admin panel: http://localhost:3000/admin");
  console.log("   2. Configure game settings and click 'Initialize Game'");
  console.log("   3. Use arrow keys to control the snake");
  console.log("   4. Snake will teleport between monitors via portals");
}

main().catch(console.error);






