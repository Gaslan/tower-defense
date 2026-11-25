# Project Rules: Isometric Tower Defense (PixiJS v8 + TypeScript)

## 1. Tech Stack & Environment
- **Bundler:** Vite
- **Language:** TypeScript (Strict Mode enabled, NO `any` types)
- **Renderer:** PixiJS v8 (`pixi.js` ^8.x)
- **Audio:** Native Web Audio API (procedural synthesis, zero external audio files)
- **UI Layer:** Standard HTML5 / CSS3 Overlay (NO PixiJS-based UI)
- **Visuals:** Procedural layered `PIXI.Graphics` and offscreen Canvas textures (zero broken external image paths).

## 2. CRITICAL: PixiJS v8 API Guardrails (Do NOT use v7 syntax)
You MUST strictly use PixiJS v8 APIs. Any v7 syntax is a bug:
- **Initialization:** Always use async init:
  `const app = new Application(); await app.init({ resizeTo: window, backgroundColor: 0x1a1a2e, antialias: true });`
- **Canvas Mount:** Use `app.canvas`, NEVER `app.view`.
- **Graphics API:** Use v8 shape-first chaining (`fill()` / `stroke()`). NEVER use deprecated `beginFill()`, `endFill()`, or `lineStyle()`.
  - Example: `graphics.poly([...]).fill(0x2ecc71).stroke({ width: 1, color: 0x1e8449 });`
- **Interactivity:** Use `displayObject.eventMode = 'static'` (or `'none'`). NEVER use `interactive = true`.
- **Containers:** Do NOT add children to `Sprite` or `Graphics` objects (deprecated in v8). Always use `Container` as parent nodes.

## 3. Architecture & Directory Structure
Maintain strict separation between **Config**, **Simulation/Logic**, **Visuals**, **Audio**, and **HTML UI**. Never put game rules inside `main.ts` or UI event handlers.

    src/
    ├── config/
    │   ├── constants.ts       # Grid dimensions, TILE_WIDTH (64), TILE_HEIGHT (32), map layout
    │   ├── units.ts           # Data-driven stats & upgrade curves for Archer, Knight, Mage
    │   └── enemies.ts         # Data-driven stats for Scout, Grunt, Brute & wave scaling rules
    ├── core/
    │   ├── IsoMath.ts         # Pure math: gridToScreen, screenToGrid, gridDistance
    │   ├── EventBus.ts        # Typed pub/sub syncing GameState/Combat -> HTML UI & Audio
    │   └── GameState.ts       # Single source of truth: gold, lives, wave, grid occupancy
    ├── graphics/
    │   └── UnitVisuals.ts     # Layered procedural character builders & level visual evolution
    ├── entities/
    │   ├── HumanUnit.ts       # Unit logic, XP/Leveling, state machine (IDLE/TRACKING/ATTACKING)
    │   ├── Enemy.ts           # Waypoint-following enemy, HP bar, walking hop animation
    │   └── Projectile.ts      # Visual + logic for attacks (tracks `sourceUnit` for XP attribution)
    ├── systems/
    │   ├── GridSystem.ts      # Isometric map rendering, hover, unit placement & unit inspection
    │   ├── WaveSystem.ts      # Wave scaling, mixed enemy spawning, boss waves
    │   ├── CombatSystem.ts    # Range detection, targeting, damage, kill-XP attribution
    │   └── SoundSystem.ts     # Procedural Web Audio API SFX synthesizer + mute state
    ├── ui/
    │   └── HudController.ts   # Connects HTML/CSS HUD, Unit Inspector/Upgrade Panel & Audio toggle
    └── main.ts                # Bootstrap PixiJS app, initialize systems, drive app.ticker

## 4. Isometric Math & Depth Sorting Rules
- **Tile Dimensions:** Default `TILE_WIDTH = 64`, `TILE_HEIGHT = 32` (2:1 isometric ratio).
- **Coordinate Conversion (`IsoMath.ts`):**
  - `gridToScreen(gx, gy)`: `screenX = (gx - gy) * (TILE_WIDTH / 2)`, `screenY = (gx + gy) * (TILE_HEIGHT / 2)`.
  - `screenToGrid(sx, sy)`: Must accurately invert `gridToScreen` accounting for the world container offset.
- **Layering:** Separate the world into distinct `Container` layers:
  1. `tileLayer` (static ground & path tiles)
  2. `highlightLayer` (hover cursor, placement/inspection range circle)
  3. `entityLayer` (units, enemies, projectiles, floating upgrade icons) — MUST have `sortableChildren = true`.
- **Z-Sorting:** Every entity in `entityLayer` MUST update `zIndex = gridX + gridY` (fractional for moving enemies).

## 5. Entities, Progression & Economy Rules
- **Units (`src/config/units.ts`):** Archer (fast single-target), Knight (short-range high-damage melee), Mage (slow AoE splash).
- **XP & Leveling (`HumanUnit.ts`):**
  - Units start at Level 1 (max Level 3).
  - Every `Projectile` and melee hit MUST carry a `sourceUnit` reference so the killing unit receives XP on enemy death.
  - When `xp >= xpToNextLevel && level < maxLevel`, set `canUpgrade = true` and render a floating golden upgrade indicator (`▲`) above the unit.
  - Upgrading requires clicking the unit to open the HTML Inspector Panel and spending gold (`GameState.gold >= unit.upgradeCost`).
- **Enemies & Waves (`src/config/enemies.ts`):**
  - 3 distinct types: Scout (fast/low HP), Grunt (balanced), Brute (slow/high HP/high reward), plus Boss variants on every 5th wave.
  - Enemy count and HP scale per wave; keep scaling formulas centralized in `enemies.ts` or `WaveSystem.ts`.

## 6. Visuals & Animation State Machine
- **Character Visuals (`UnitVisuals.ts`):** Build stylized isometric human figures using nested `Container` parts (shadow, body, head, weapon) so parts can animate independently. Evolve visual trim/glow at Level 2 and Level 3.
- **Unit States (`HumanUnit.ts`):** Every unit runs a lightweight state machine updated via `dt`:
  - `IDLE`: Subtle breathing bobbing and gentle weapon sway.
  - `TRACKING`: Flip horizontal orientation (`scale.x`) toward target's screen X and aim weapon toward target.
  - `ATTACKING`: Short (~0.25s) punchy recoil/lunge/cast animation triggered on fire.

## 7. Audio System Rules (`SoundSystem.ts`)
- Use native `AudioContext` (Web Audio API) for all SFX (`playArcherShoot`, `playKnightSlash`, `playMageCast`, `playEnemyDeath`, `playUpgrade`, `playPlaceUnit`).
- Resume `AudioContext` safely on the first user pointer interaction to comply with browser autoplay policies.
- Decouple audio from rendering: trigger sounds from `CombatSystem`, `GridSystem`, or `EventBus` listeners. Provide a mute toggle in the HTML HUD.

## 8. UI & Canvas Separation
- **Canvas:** Renders ONLY the isometric map, highlights, range previews, units, enemies, health bars, upgrade icons, and projectiles.
- **HTML/CSS Overlay:** Renders ALL menus, Gold/Lives/Wave HUD, Mute button, bottom Unit Selection bar, Unit Inspector/Upgrade Panel, and Game Over overlay (`position: fixed; pointer-events: none` on wrapper, `pointer-events: auto` on interactive panels).
- Sync all state changes via `EventBus` (e.g., `goldChanged`, `livesChanged`, `waveChanged`, `unitSelected`, `unitInspected`).

## 9. Game Loop & Memory Management
- **Frame-Rate Independence:** All movement, animations, cooldowns, and spawn timers inside `app.ticker.add((ticker) => ...)` MUST use `dt = ticker.deltaMS / 1000`.
- **Cleanup:** When an enemy dies or a projectile finishes, explicitly remove it from its parent container, call `.destroy({ children: true })`, and remove it from active arrays to prevent memory leaks.

## 10. Antigravity & Gemini Agent Workflow
1. Always propose a short implementation plan before editing files when starting a new phase.
2. Implement one phase at a time. Do not scaffold unused abstractions.
3. After code changes, run `npm run build` (`tsc && vite build`) in the terminal to verify zero TypeScript or bundler errors.
4. Keep files small and focused (under 200 lines per file where possible).