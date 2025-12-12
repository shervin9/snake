# Snake Game - Server Deployment (Ubuntu)

## Quick Setup

1. **Copy game.config.example.json to game.config.json**:
```bash
cp game.config.example.json game.config.json
# Edit if needed
nano game.config.json
```

2. **Ensure single PM2 instance** (CRITICAL):
```bash
# Stop all instances
pm2 stop all
pm2 delete all

# Start with EXACTLY 1 instance in fork mode
pm2 start npm --name "snake" -- start -- -p 3000
pm2 save

# Verify only 1 instance running
pm2 list
# Should show: snake | 1 | fork mode
```

3. **Verify it's working**:
```bash
# Check state
curl http://localhost:3000/api/state | jq '.state.phase'
# Should show: "idle"

# Start game
curl -X POST http://localhost:3000/api/state/control -H "Content-Type: application/json" -d '{"action":"start"}'

# Check it's running
curl http://localhost:3000/api/state | jq '.state | {phase, tick, foods: (.foods | length)}'
# Should show phase="running", tick increasing
```

## Troubleshooting

### Game dies immediately
- Check PM2 logs: `pm2 logs snake --lines 50`
- Look for "wall collision" or "self collision"
- Verify monitors are being generated correctly

### Multiple PIDs in logs
- **Problem**: Multiple PM2 processes serving requests
- **Fix**: `pm2 delete all && pm2 start npm --name snake -- start`
- Verify with `pm2 list` - should show ONLY 1 instance

### State not persisting between requests  
- **Problem**: Running in cluster mode
- **Fix**: Use fork mode (default with above command)
- Check with `pm2 show snake | grep mode` - should be "fork"

## Configuration

Edit `game.config.json`:
```json
{
  "monitorCount": 6,      // Number of monitors (1-12)
  "timerSeconds": 120,    // Game duration
  "foodPerMonitor": 5     // Food items per monitor
}
```

**After changing config**: `pm2 restart snake`

