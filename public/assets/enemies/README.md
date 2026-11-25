# External Enemy Sprite Sheets

Drop horizontal 2D sprite strips into this directory to automatically replace any enemy tier's procedural graphics. Missing `walk.png` files fall back silently to procedural rendering, and `death.png` is optional (missing `death.png` falls back to instant particle death burst).

## Expected Directory Structure

```text
public/assets/enemies/
├── scout/
│   ├── walk.png
│   └── death.png     (optional)
├── grunt/
│   ├── walk.png
│   └── death.png     (optional)
├── brute/
│   ├── walk.png
│   └── death.png     (optional)
└── boss/
    ├── walk.png
    └── death.png     (optional)
```

## Strip Layout Specification
- **Format:** Transparent PNG, horizontal strip (single row).
- **Frame Size:** `128 × 128` pixels per frame (matching `src/config/sprites.ts`).
- **Walk Strip (`walk.png`):** `6` frames -> `768 × 128` px (`8–12 FPS`, looping, synced to game speed & slow status).
- **Death Strip (`death.png`):** `6` frames -> `768 × 128` px (`12–14 FPS`, plays once on 0 HP, then removes enemy).
- **Target Display Heights:** Scout `44px`, Grunt `52px`, Brute `64px`, Boss `82px`.
- **Anchor:** Feet centered horizontally (`0.5`) at `anchorY = 0.85`, facing **right** (automatically flipped horizontally when walking left).
