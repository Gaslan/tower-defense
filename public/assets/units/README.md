# External Unit Sprite Sheets

Drop horizontal 2D sprite strips into this directory to automatically replace any unit's procedural graphics. Missing files silently fall back to the built-in procedural renderer.

## Expected Directory Structure

```text
public/assets/units/
├── archer/
│   ├── idle.png
│   └── attack.png
├── knight/
│   ├── idle.png
│   └── attack.png
├── mage/
│   ├── idle.png
│   └── attack.png
├── bannerman/
│   ├── idle.png
│   └── attack.png
├── miner/
│   ├── idle.png
│   └── attack.png
└── frost_mage/
    ├── idle.png
    └── attack.png
```

## Strip Layout Specification
- **Format:** Transparent PNG, horizontal strip (single row).
- **Frame Size:** `128 × 128` pixels per frame (matching `src/config/sprites.ts`).
- **Idle Strip (`idle.png`):** `4` frames -> `512 × 128` px (`6 FPS`, looping).
- **Attack Strip (`attack.png`):** `6` frames -> `768 × 128` px (`12–14 FPS`, plays once and returns to idle).
- **Anchor:** Feet centered horizontally (`0.5`) at `anchorY = 0.85`, facing **right** (automatically flipped horizontally when tracking left).
