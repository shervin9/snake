# 🐍 Snake Game - Multi-Monitor Edition

A modern, multi-monitor snake game built with Next.js, Pixi.js, and Tailwind CSS. The snake can seamlessly travel across multiple monitors through portals, making this perfect for events, displays, or multi-screen setups.

![Snake Game Preview](https://via.placeholder.com/800x400?text=Snake+Game+Multi-Monitor)

## ✨ Features

- **Multi-Monitor Support**: Play across 1-9 monitors with automatic portal generation
- **Modern UI**: Clean, minimal design with smooth animations using Tailwind CSS
- **Real-Time Sync**: All monitors sync game state via server-side polling
- **Responsive Controls**: Buffered keyboard input for precise movement
- **Configurable Settings**: Customize monitor count, game duration, and food items
- **Beautiful Rendering**: GPU-accelerated graphics with Pixi.js

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm

### Installation

```bash
# Clone or navigate to the project
cd /path/to/snack

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Access Points

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Home page with overview |
| http://localhost:3000/admin | Operator panel (game controls) |
| http://localhost:3000/monitor/0 | Monitor 0 view |
| http://localhost:3000/monitor/1 | Monitor 1 view |
| http://localhost:3000/api/state | Game state API |
| http://localhost:3000/api/monitors | Monitor configuration API |

## 🎮 How to Play

1. **Setup**: Open the admin panel (`/admin`) and configure:
   - Number of monitors (1-9)
   - Game duration (30-600 seconds)
   - Food items per monitor (1-20)

2. **Initialize**: Click "Initialize Game" to set up the game board

3. **Start**: Click "Start" or press the start button on monitor 0

4. **Control**: Use arrow keys to move the snake:
   - `↑` Move up
   - `↓` Move down
   - `←` Move left
   - `→` Move right

5. **Objective**: Eat food (red/yellow circles) to score points and grow

6. **Portals**: Enter purple portals at screen edges to teleport between monitors

## 🖥️ Multi-Monitor Setup

### Option 1: Multiple Browser Windows

Open each monitor URL in a separate browser window:

```
http://localhost:3000/monitor/0
http://localhost:3000/monitor/1
http://localhost:3000/monitor/2
...
```

### Option 2: Automated Chrome Launcher

Use the included script to launch windows automatically:

```bash
# Launch with default 6 monitors
pnpm launch:chrome

# Custom monitor count
node scripts/launch-chrome.js --count 4

# Custom URL (for remote server)
node scripts/launch-chrome.js --url http://192.168.1.100:3000/monitor

# Debug mode (no kiosk)
node scripts/launch-chrome.js --no-kiosk
```

### Physical Multi-Monitor Configuration

For actual multi-monitor setups:

1. Connect monitors to your computer
2. Position browser windows on each display
3. Press F11 for fullscreen on each window
4. Use the launcher script with kiosk mode enabled

## 🔧 Configuration

### Game Configuration

Configure via the admin panel or modify `lib/config.ts`:

```typescript
// Game timing
export const DEFAULT_TICK_INTERVAL = 100;    // ms between moves (lower = faster)
export const DEFAULT_GAME_DURATION = 120;    // seconds

// Gameplay
export const DEFAULT_MONITOR_COUNT = 6;
export const DEFAULT_FOOD_PER_MONITOR = 5;
export const POINTS_PER_FOOD = 10;

// Display
export const MONITOR_WIDTH = 1920;
export const MONITOR_HEIGHT = 1080;
export const CELL_SIZE = 30;
```

### Monitor Layout

Monitors are arranged in a grid pattern. The layout is automatically calculated based on monitor count:

| Count | Layout |
|-------|--------|
| 1 | 1x1 |
| 2 | 2x1 |
| 3 | 2x2 (3 monitors) |
| 4 | 2x2 |
| 5-6 | 3x2 |
| 7-9 | 3x3 |

### Rotation Support

For rotated monitors (portrait mode), configure in `config/monitors.json`:

```json
[
  { "id": "0", "row": 0, "col": 0, "rotationDeg": 0 },
  { "id": "1", "row": 0, "col": 1, "rotationDeg": 90 }
]
```

Supported rotations: `0`, `90`, `180`, `270`

## 🏗️ Project Structure

```
snack/
├── app/                    # Next.js app router
│   ├── admin/             # Operator control panel
│   ├── api/               # REST API endpoints
│   │   ├── monitors/      # Monitor configuration
│   │   ├── portals/       # Portal configuration
│   │   └── state/         # Game state management
│   └── monitor/[id]/      # Dynamic monitor pages
├── components/ui/          # Reusable UI components
├── lib/                    # Core game logic
│   ├── serverEngine.ts    # Game state & collision detection
│   ├── config.ts          # Game constants
│   ├── types.ts           # TypeScript definitions
│   └── utils.ts           # Utility functions
├── config/                 # Static configuration files
└── scripts/               # Automation scripts
```

## 🧪 API Reference

### GET /api/state

Returns current game state and configuration.

```json
{
  "state": {
    "phase": "running",
    "score": 50,
    "dir": "right",
    "snake": [{"x": 960, "y": 540}, ...],
    "foods": [{"id": "abc123", "x": 100, "y": 200, "monitorId": "0"}, ...],
    "activeMonitorId": "0",
    "timeLeftMs": 90000,
    "totalTimeMs": 120000
  },
  "config": {
    "monitorCount": 6,
    "timerSeconds": 120,
    "foodPerMonitor": 5
  }
}
```

### POST /api/state/control

Control game state.

```json
// Setup game
{ "action": "setup", "monitorCount": 4, "timerSeconds": 180, "foodPerMonitor": 3 }

// Start game
{ "action": "start" }

// Stop game
{ "action": "stop" }

// Reset game
{ "action": "reset" }
```

### POST /api/state/input

Send directional input.

```json
{ "direction": "up" }  // up, down, left, right
```

## 🔨 Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm launch:chrome # Launch multi-monitor Chrome windows
```

### Running Tests

```bash
pnpm test         # Run all tests
pnpm test:watch   # Watch mode
pnpm test:coverage # Generate coverage report
```

## 🐛 Troubleshooting

### Game ends immediately
- Check if snake is spawning too close to walls
- Verify monitor configuration is correct

### Controls feel laggy
- Reduce poll interval in monitor canvas
- Check network latency if running remotely

### Monitors not syncing
- Ensure all monitors are pointing to the same server
- Check browser console for API errors

### Food not appearing
- Verify food spawn logic has valid positions
- Check that monitor IDs match between config and API

## 📄 License

MIT License - feel free to use this project for events, education, or fun!

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.




