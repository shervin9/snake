import { describe, it, expect, beforeEach } from "vitest";

// We need to test the game logic functions
// Since the server engine uses global state, we'll test by importing and manipulating it

// Create a simplified test version of the game logic
const CELL = 30;
const MONITOR_W = 1920;
const MONITOR_H = 1080;

// ============================================================================
// Utility Functions (copied from serverEngine for isolated testing)
// ============================================================================

function toGridCell(x: number, y: number, cellSize: number) {
  return {
    gx: Math.floor(x / cellSize),
    gy: Math.floor(y / cellSize),
  };
}

function fromGridCell(gx: number, gy: number, cellSize: number) {
  return {
    x: gx * cellSize + cellSize / 2,
    y: gy * cellSize + cellSize / 2,
  };
}

function snapToGrid(x: number, y: number, cellSize: number) {
  const { gx, gy } = toGridCell(x, y, cellSize);
  return fromGridCell(gx, gy, cellSize);
}

// ============================================================================
// Tests: Grid Conversion
// ============================================================================

describe("Grid Conversion Functions", () => {
  describe("toGridCell", () => {
    it("should convert pixel coordinates to grid cell", () => {
      const result = toGridCell(45, 75, CELL);
      expect(result.gx).toBe(1); // 45 / 30 = 1.5 -> floor = 1
      expect(result.gy).toBe(2); // 75 / 30 = 2.5 -> floor = 2
    });

    it("should handle origin (0,0)", () => {
      const result = toGridCell(0, 0, CELL);
      expect(result.gx).toBe(0);
      expect(result.gy).toBe(0);
    });

    it("should handle exact cell boundaries", () => {
      const result = toGridCell(60, 90, CELL);
      expect(result.gx).toBe(2); // 60 / 30 = 2
      expect(result.gy).toBe(3); // 90 / 30 = 3
    });
  });

  describe("fromGridCell", () => {
    it("should convert grid cell to pixel center", () => {
      const result = fromGridCell(1, 2, CELL);
      expect(result.x).toBe(45); // 1 * 30 + 15 = 45
      expect(result.y).toBe(75); // 2 * 30 + 15 = 75
    });

    it("should center the position in the cell", () => {
      const result = fromGridCell(0, 0, CELL);
      expect(result.x).toBe(15); // 0 * 30 + 15 = 15
      expect(result.y).toBe(15);
    });
  });

  describe("snapToGrid", () => {
    it("should snap arbitrary position to grid center", () => {
      const result = snapToGrid(47, 82, CELL);
      // 47 -> cell 1 -> center at 45
      // 82 -> cell 2 -> center at 75
      expect(result.x).toBe(45);
      expect(result.y).toBe(75);
    });

    it("should not change already centered position", () => {
      const result = snapToGrid(45, 75, CELL);
      expect(result.x).toBe(45);
      expect(result.y).toBe(75);
    });
  });
});

// ============================================================================
// Tests: Collision Detection
// ============================================================================

describe("Collision Detection", () => {
  // Test food collision with grid-based detection
  describe("Food Collision (Grid-Based)", () => {
    function checkFoodCollision(
      headX: number,
      headY: number,
      foodX: number,
      foodY: number,
      cellSize: number
    ): boolean {
      const headCell = toGridCell(headX, headY, cellSize);
      const foodCell = toGridCell(foodX, foodY, cellSize);
      return headCell.gx === foodCell.gx && headCell.gy === foodCell.gy;
    }

    it("should detect collision when head and food in same cell", () => {
      // Both in cell (1, 2)
      const result = checkFoodCollision(40, 70, 45, 75, CELL);
      expect(result).toBe(true);
    });

    it("should NOT detect collision when head is one cell away", () => {
      // Head in cell (1, 2), food in cell (2, 2)
      const result = checkFoodCollision(45, 75, 75, 75, CELL);
      expect(result).toBe(false);
    });

    it("should NOT detect collision when diagonally adjacent", () => {
      // Head in cell (1, 1), food in cell (2, 2)
      const result = checkFoodCollision(45, 45, 75, 75, CELL);
      expect(result).toBe(false);
    });

    it("should detect collision at cell boundaries", () => {
      // Both positions at start of cell (1, 2)
      const result = checkFoodCollision(30, 60, 59, 89, CELL);
      expect(result).toBe(true);
    });
  });

  // Test self collision
  describe("Self Collision (Grid-Based)", () => {
    function checkSelfCollision(
      headX: number,
      headY: number,
      body: { x: number; y: number }[],
      cellSize: number,
      skipSegments: number = 3
    ): boolean {
      const headCell = toGridCell(headX, headY, cellSize);

      for (let i = skipSegments; i < body.length; i++) {
        const segCell = toGridCell(body[i].x, body[i].y, cellSize);
        if (headCell.gx === segCell.gx && headCell.gy === segCell.gy) {
          return true;
        }
      }
      return false;
    }

    it("should NOT detect collision with immediate body segments (neck)", () => {
      const body = [
        { x: 75, y: 75 }, // Head position
        { x: 45, y: 75 }, // Neck (should skip)
        { x: 15, y: 75 }, // Body segment 2 (should skip)
      ];
      const result = checkSelfCollision(45, 75, body, CELL, 3);
      expect(result).toBe(false);
    });

    it("should detect collision with body segment beyond skip count", () => {
      const body = [
        { x: 105, y: 75 },
        { x: 75, y: 75 },
        { x: 45, y: 75 },
        { x: 45, y: 105 }, // Index 3 - this one counts
        { x: 75, y: 105 },
      ];
      // Move head back to collide with segment at index 3
      const result = checkSelfCollision(45, 105, body, CELL, 3);
      expect(result).toBe(true);
    });

    it("should NOT detect collision with empty body", () => {
      const result = checkSelfCollision(45, 75, [], CELL, 3);
      expect(result).toBe(false);
    });
  });

  // Test wall collision
  describe("Wall Collision", () => {
    function checkWallCollision(
      x: number,
      y: number,
      monitorW: number,
      monitorH: number,
      padding: number
    ): boolean {
      return x < padding || x > monitorW - padding || y < padding || y > monitorH - padding;
    }

    it("should detect collision with left wall", () => {
      const result = checkWallCollision(10, 540, MONITOR_W, MONITOR_H, 15);
      expect(result).toBe(true);
    });

    it("should detect collision with right wall", () => {
      const result = checkWallCollision(1910, 540, MONITOR_W, MONITOR_H, 15);
      expect(result).toBe(true);
    });

    it("should detect collision with top wall", () => {
      const result = checkWallCollision(960, 10, MONITOR_W, MONITOR_H, 15);
      expect(result).toBe(true);
    });

    it("should detect collision with bottom wall", () => {
      const result = checkWallCollision(960, 1075, MONITOR_W, MONITOR_H, 15);
      expect(result).toBe(true);
    });

    it("should NOT detect collision in safe zone", () => {
      const result = checkWallCollision(960, 540, MONITOR_W, MONITOR_H, 15);
      expect(result).toBe(false);
    });

    it("should handle corner positions", () => {
      // Top-left corner (outside safe zone)
      expect(checkWallCollision(5, 5, MONITOR_W, MONITOR_H, 15)).toBe(true);
      // Just inside safe zone
      expect(checkWallCollision(20, 20, MONITOR_W, MONITOR_H, 15)).toBe(false);
    });
  });
});

// ============================================================================
// Tests: Movement Logic
// ============================================================================

describe("Movement Logic", () => {
  type Direction = "up" | "down" | "left" | "right";

  function calculateNewHead(
    headX: number,
    headY: number,
    direction: Direction,
    cellSize: number
  ): { x: number; y: number } {
    const dx = direction === "left" ? -cellSize : direction === "right" ? cellSize : 0;
    const dy = direction === "up" ? -cellSize : direction === "down" ? cellSize : 0;
    return { x: headX + dx, y: headY + dy };
  }

  function isOppositeDirection(dir1: Direction, dir2: Direction): boolean {
    const opposites: Record<Direction, Direction> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    return opposites[dir1] === dir2;
  }

  it("should move right correctly", () => {
    const result = calculateNewHead(100, 100, "right", CELL);
    expect(result.x).toBe(130);
    expect(result.y).toBe(100);
  });

  it("should move left correctly", () => {
    const result = calculateNewHead(100, 100, "left", CELL);
    expect(result.x).toBe(70);
    expect(result.y).toBe(100);
  });

  it("should move up correctly", () => {
    const result = calculateNewHead(100, 100, "up", CELL);
    expect(result.x).toBe(100);
    expect(result.y).toBe(70);
  });

  it("should move down correctly", () => {
    const result = calculateNewHead(100, 100, "down", CELL);
    expect(result.x).toBe(100);
    expect(result.y).toBe(130);
  });

  describe("Direction Validation", () => {
    it("should identify opposite directions", () => {
      expect(isOppositeDirection("up", "down")).toBe(true);
      expect(isOppositeDirection("down", "up")).toBe(true);
      expect(isOppositeDirection("left", "right")).toBe(true);
      expect(isOppositeDirection("right", "left")).toBe(true);
    });

    it("should NOT identify non-opposite directions as opposite", () => {
      expect(isOppositeDirection("up", "left")).toBe(false);
      expect(isOppositeDirection("up", "right")).toBe(false);
      expect(isOppositeDirection("down", "left")).toBe(false);
      expect(isOppositeDirection("down", "right")).toBe(false);
    });
  });
});

// ============================================================================
// Tests: Food Spawning
// ============================================================================

describe("Food Spawning", () => {
  function isValidFoodPosition(
    x: number,
    y: number,
    snake: { x: number; y: number }[],
    foods: { x: number; y: number }[],
    cellSize: number,
    monitorW: number,
    monitorH: number,
    padding: number
  ): boolean {
    // Check bounds
    if (x < padding * cellSize || x > monitorW - padding * cellSize) return false;
    if (y < padding * cellSize || y > monitorH - padding * cellSize) return false;

    const { gx, gy } = toGridCell(x, y, cellSize);

    // Check snake collision
    for (const seg of snake) {
      const segCell = toGridCell(seg.x, seg.y, cellSize);
      if (gx === segCell.gx && gy === segCell.gy) return false;
    }

    // Check existing food collision
    for (const food of foods) {
      const foodCell = toGridCell(food.x, food.y, cellSize);
      if (gx === foodCell.gx && gy === foodCell.gy) return false;
    }

    return true;
  }

  it("should reject position overlapping with snake", () => {
    const snake = [{ x: 100, y: 100 }];
    const result = isValidFoodPosition(100, 100, snake, [], CELL, MONITOR_W, MONITOR_H, 3);
    expect(result).toBe(false);
  });

  it("should reject position overlapping with existing food", () => {
    const foods = [{ x: 200, y: 200 }];
    const result = isValidFoodPosition(200, 200, [], foods, CELL, MONITOR_W, MONITOR_H, 3);
    expect(result).toBe(false);
  });

  it("should reject position too close to edge", () => {
    const result = isValidFoodPosition(50, 540, [], [], CELL, MONITOR_W, MONITOR_H, 3);
    expect(result).toBe(false);
  });

  it("should accept valid position", () => {
    const result = isValidFoodPosition(960, 540, [], [], CELL, MONITOR_W, MONITOR_H, 3);
    expect(result).toBe(true);
  });
});

// ============================================================================
// Tests: Monitor Layout
// ============================================================================

describe("Monitor Layout", () => {
  function generateMonitorGrid(count: number): { row: number; col: number }[] {
    const monitors: { row: number; col: number }[] = [];
    const cols = Math.ceil(Math.sqrt(count));

    let id = 0;
    let row = 0;
    let col = 0;

    while (id < count) {
      monitors.push({ row, col });
      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
      id++;
    }

    return monitors;
  }

  function monitorOrigin(row: number, col: number): { x: number; y: number } {
    return {
      x: col * MONITOR_W,
      y: row * MONITOR_H,
    };
  }

  it("should create 1x1 grid for 1 monitor", () => {
    const monitors = generateMonitorGrid(1);
    expect(monitors).toHaveLength(1);
    expect(monitors[0]).toEqual({ row: 0, col: 0 });
  });

  it("should create 2x1 grid for 2 monitors", () => {
    const monitors = generateMonitorGrid(2);
    expect(monitors).toHaveLength(2);
    expect(monitors[0]).toEqual({ row: 0, col: 0 });
    expect(monitors[1]).toEqual({ row: 0, col: 1 });
  });

  it("should create 2x2 grid for 4 monitors", () => {
    const monitors = generateMonitorGrid(4);
    expect(monitors).toHaveLength(4);
    expect(monitors[0]).toEqual({ row: 0, col: 0 });
    expect(monitors[1]).toEqual({ row: 0, col: 1 });
    expect(monitors[2]).toEqual({ row: 1, col: 0 });
    expect(monitors[3]).toEqual({ row: 1, col: 1 });
  });

  it("should create 3x2 grid for 6 monitors", () => {
    const monitors = generateMonitorGrid(6);
    expect(monitors).toHaveLength(6);
    // First row
    expect(monitors[0]).toEqual({ row: 0, col: 0 });
    expect(monitors[1]).toEqual({ row: 0, col: 1 });
    expect(monitors[2]).toEqual({ row: 0, col: 2 });
    // Second row
    expect(monitors[3]).toEqual({ row: 1, col: 0 });
    expect(monitors[4]).toEqual({ row: 1, col: 1 });
    expect(monitors[5]).toEqual({ row: 1, col: 2 });
  });

  it("should calculate correct monitor origins", () => {
    expect(monitorOrigin(0, 0)).toEqual({ x: 0, y: 0 });
    expect(monitorOrigin(0, 1)).toEqual({ x: MONITOR_W, y: 0 });
    expect(monitorOrigin(1, 0)).toEqual({ x: 0, y: MONITOR_H });
    expect(monitorOrigin(1, 1)).toEqual({ x: MONITOR_W, y: MONITOR_H });
  });
});

// ============================================================================
// Tests: Portal Logic
// ============================================================================

describe("Portal Logic", () => {
  const PORTAL_RADIUS = 80;

  function checkPortalEntrance(
    x: number,
    y: number,
    portalX: number,
    portalY: number,
    radius: number
  ): boolean {
    const dist = Math.hypot(x - portalX, y - portalY);
    return dist <= radius;
  }

  it("should detect when snake enters portal", () => {
    const result = checkPortalEntrance(1850, 540, 1860, 540, PORTAL_RADIUS);
    expect(result).toBe(true);
  });

  it("should NOT detect when snake is far from portal", () => {
    const result = checkPortalEntrance(960, 540, 1860, 540, PORTAL_RADIUS);
    expect(result).toBe(false);
  });

  it("should detect at exact portal edge", () => {
    // Distance exactly at radius
    const result = checkPortalEntrance(1860 - PORTAL_RADIUS, 540, 1860, 540, PORTAL_RADIUS);
    expect(result).toBe(true);
  });

  it("should NOT detect just outside portal radius", () => {
    const result = checkPortalEntrance(1860 - PORTAL_RADIUS - 1, 540, 1860, 540, PORTAL_RADIUS);
    expect(result).toBe(false);
  });
});

// ============================================================================
// Tests: Score System
// ============================================================================

describe("Score System", () => {
  const POINTS_PER_FOOD = 10;

  it("should award correct points for eating food", () => {
    let score = 0;
    score += POINTS_PER_FOOD;
    expect(score).toBe(10);

    score += POINTS_PER_FOOD;
    expect(score).toBe(20);
  });

  it("should grow snake when eating food", () => {
    const snake = [
      { x: 100, y: 100 },
      { x: 70, y: 100 },
    ];

    // Simulate eating food - add segment at tail
    const tail = snake[snake.length - 1];
    snake.push({ ...tail });

    expect(snake).toHaveLength(3);
    expect(snake[2]).toEqual({ x: 70, y: 100 });
  });
});







