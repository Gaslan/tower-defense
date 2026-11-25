import { Container, Graphics } from 'pixi.js';
import type { UnitId } from '../config/units';

export interface UnitVisualRig {
  readonly baseGraphic: Graphics;
  readonly characterContainer: Container;
  readonly bodyContainer: Container;
  readonly bodyGraphic: Graphics;
  readonly weaponContainer: Container;
  readonly weaponGraphic: Graphics;
  readonly effectGraphic: Graphics;
}

const SKIN_COLOR = 0xf5cba7;
const GOLD_TRIM = 0xf1c40f;
const MYTHIC_VIOLET = 0xd980fa;
const MYTHIC_CYAN = 0x7df9ff;

export function getWeaponAnchor(unitId: UnitId): { x: number; y: number } {
  switch (unitId) {
    case 'archer':
      return { x: 5, y: -13 };
    case 'knight':
      return { x: 7, y: -12 };
    case 'mage':
    case 'miner':
    case 'frost_mage':
      return { x: 7, y: -11 };
    case 'bannerman':
      return { x: 7, y: -12 };
  }
}

export function createUnitVisualRig(unitId: UnitId): UnitVisualRig {
  const baseGraphic = new Graphics();
  const characterContainer = new Container();
  const bodyContainer = new Container();
  const bodyGraphic = new Graphics();
  const weaponContainer = new Container();
  const weaponGraphic = new Graphics();
  const effectGraphic = new Graphics();

  effectGraphic.visible = false;

  const anchor = getWeaponAnchor(unitId);
  weaponContainer.position.set(anchor.x, anchor.y);

  bodyContainer.addChild(bodyGraphic);
  weaponContainer.addChild(weaponGraphic, effectGraphic);
  characterContainer.addChild(bodyContainer, weaponContainer);

  return {
    baseGraphic,
    characterContainer,
    bodyContainer,
    bodyGraphic,
    weaponContainer,
    weaponGraphic,
    effectGraphic,
  };
}

export function drawUnitVisuals(
  rig: UnitVisualRig,
  unitId: UnitId,
  level: number,
): void {
  drawBase(rig.baseGraphic, unitId, level);
  rig.bodyGraphic.clear();
  rig.weaponGraphic.clear();

  switch (unitId) {
    case 'archer':
      drawArcherBody(rig.bodyGraphic, level);
      drawArcherWeapon(rig.weaponGraphic, level, 0, true);
      break;
    case 'knight':
      drawKnight(rig.bodyGraphic, rig.weaponGraphic, level);
      break;
    case 'mage':
      drawMage(rig.bodyGraphic, rig.weaponGraphic, level);
      break;
    case 'bannerman':
      drawBannerman(rig.bodyGraphic, rig.weaponGraphic, level);
      break;
    case 'miner':
      drawMiner(rig.bodyGraphic, rig.weaponGraphic, level);
      break;
    case 'frost_mage':
      drawFrostMage(rig.bodyGraphic, rig.weaponGraphic, level);
      break;
  }
}

function getClassAccent(unitId: UnitId): number {
  switch (unitId) {
    case 'archer':
      return 0x2ecc71;
    case 'knight':
      return 0x5dade2;
    case 'mage':
      return 0xbb8fce;
    case 'bannerman':
      return 0xf39c12;
    case 'miner':
      return 0xd4ac0d;
    case 'frost_mage':
      return 0x7df9ff;
  }
}

function drawBase(graphic: Graphics, unitId: UnitId, level: number): void {
  const rimColor =
    level >= 5
      ? MYTHIC_CYAN
      : level >= 4
        ? MYTHIC_VIOLET
        : level >= 3
          ? GOLD_TRIM
          : level === 2
            ? 0xd4ac0d
            : 0x1a252f;
  const rimWidth = level >= 4 ? 2.1 : level >= 2 ? 1.8 : 1.4;
  const accentColor = getClassAccent(unitId);

  graphic.clear();

  if (level >= 4) {
    const auraColor = level >= 6 ? MYTHIC_CYAN : MYTHIC_VIOLET;
    graphic
      .ellipse(0, 1.5, 20.5, 8.8)
      .fill({ color: auraColor, alpha: level >= 5 ? 0.2 : 0.13 })
      .stroke({ width: 1.3, color: auraColor, alpha: 0.68 });
    if (level >= 6) {
      graphic
        .ellipse(0, 1.5, 23.5, 10.2)
        .stroke({ width: 1.1, color: GOLD_TRIM, alpha: 0.72 });
    }
  }

  graphic
    .ellipse(0, 2.5, 16.5, 6.8)
    .fill({ color: 0x000000, alpha: 0.35 })
    .ellipse(0, 1.5, 14, 5.8)
    .fill(0x1a252f)
    .ellipse(0, 0, 13.5, 5.5)
    .fill(0x2c3e50)
    .stroke({ width: rimWidth, color: rimColor })
    .ellipse(0, 0, 10.2, 4.0)
    .fill(0x1e2838);

  if (level >= 2) {
    graphic.ellipse(0, 0, 10.2, 4.0).stroke({
      width: 1.1,
      color: level >= 4 ? MYTHIC_CYAN : accentColor,
      alpha: level >= 3 ? 0.9 : 0.6,
    });
  }

  const pipCount = Math.min(6, Math.max(1, level));
  const pipSpacing =
    pipCount >= 6 ? 4.8 : pipCount === 5 ? 5.5 : pipCount === 4 ? 6.2 : 7;
  const startX = -((pipCount - 1) * pipSpacing) / 2;
  for (let i = 0; i < pipCount; i++) {
    const px = startX + i * pipSpacing;
    const py = 6.0 - Math.abs(px) * 0.04;
    const pipFill =
      i >= 5 ? MYTHIC_CYAN : i >= 3 ? MYTHIC_VIOLET : GOLD_TRIM;
    const pipStroke = i >= 3 ? 0xffffff : 0x1a1a2e;
    graphic
      .poly([px, py - 1.8, px + 2.1, py, px, py + 1.8, px - 2.1, py])
      .fill(pipFill)
      .stroke({ width: 0.85, color: pipStroke });
  }
}

export function drawSpriteBaseOverlay(
  graphic: Graphics,
  unitId: UnitId,
  level: number,
): void {
  const accentColor = getClassAccent(unitId);
  graphic.clear();

  if (level >= 4) {
    const auraColor = level >= 6 ? MYTHIC_CYAN : MYTHIC_VIOLET;
    graphic
      .ellipse(0, 1.5, 20.5, 8.8)
      .fill({ color: auraColor, alpha: level >= 5 ? 0.2 : 0.13 })
      .stroke({ width: 1.3, color: auraColor, alpha: 0.68 });
    if (level >= 6) {
      graphic
        .ellipse(0, 1.5, 23.5, 10.2)
        .stroke({ width: 1.1, color: GOLD_TRIM, alpha: 0.72 });
    }
  } else if (level >= 2) {
    graphic.ellipse(0, 1, 15.5, 6.2).stroke({
      width: 1.1,
      color: level >= 3 ? GOLD_TRIM : accentColor,
      alpha: level >= 3 ? 0.7 : 0.48,
    });
  }

  graphic.ellipse(0, 2, 16, 6.5).fill({ color: 0x000000, alpha: 0.36 });

  const pipCount = Math.min(6, Math.max(1, level));
  const pipSpacing =
    pipCount >= 6 ? 4.8 : pipCount === 5 ? 5.5 : pipCount === 4 ? 6.2 : 7;
  const startX = -((pipCount - 1) * pipSpacing) / 2;
  for (let i = 0; i < pipCount; i++) {
    const px = startX + i * pipSpacing;
    const py = 6.2 - Math.abs(px) * 0.04;
    const pipFill =
      i >= 5 ? MYTHIC_CYAN : i >= 3 ? MYTHIC_VIOLET : GOLD_TRIM;
    const pipStroke = i >= 3 ? 0xffffff : 0x1a1a2e;
    graphic
      .poly([px, py - 1.8, px + 2.1, py, px, py + 1.8, px - 2.1, py])
      .fill(pipFill)
      .stroke({ width: 0.85, color: pipStroke });
  }
}

function drawArcherBody(body: Graphics, level: number): void {
  const cloakShadow = level >= 3 ? 0x145a32 : 0x0e3d21;
  const cloakColor = level >= 3 ? 0x229954 : level === 2 ? 0x1e8449 : 0x196f3d;
  const cloakHighlight = level >= 3 ? 0x58d68d : 0x27ae60;
  const tunicColor = level >= 2 ? 0x2ecc71 : 0x239b56;
  const trimColor = level >= 2 ? GOLD_TRIM : 0x8e5403;

  // Flowing ranger cloak (back layer)
  body
    .poly([-3, -15, -10.5, -5.5, -6, -1.5, -1, -3.5])
    .fill(cloakShadow)
    .stroke({ width: 1, color: 0x0b2d18 })
    .poly([-3.5, -14.5, -8.5, -6.5, -4.5, -4])
    .fill(cloakHighlight);
  if (level >= 2) {
    body
      .moveTo(-10.2, -5.5)
      .lineTo(-6, -1.8)
      .stroke({ width: 1.4, color: GOLD_TRIM });
  }

  // Detailed leather quiver with brass collar and feathered arrows
  body
    .poly([-7.5, -20.5, -3.5, -22, -1.5, -10, -5.5, -8.5])
    .fill(0x6e2c00)
    .stroke({ width: 1, color: 0x3b1800 })
    .poly([-7.5, -20.5, -3.5, -22, -3.2, -20, -7.2, -18.5])
    .fill(0xd4ac0d)
    .moveTo(-6, -21)
    .lineTo(-7.2, -24.2)
    .moveTo(-4.8, -21.5)
    .lineTo(-5, -25)
    .moveTo(-3.6, -21.8)
    .lineTo(-2.8, -24)
    .stroke({ width: 1, color: 0xfdfefe })
    .poly([-7.2, -24.2, -8.8, -23.5, -6.4, -22.2])
    .fill(0x58d68d)
    .poly([-5, -25, -6.2, -23.2, -3.8, -23.2])
    .fill(GOLD_TRIM)
    .poly([-2.8, -24, -4, -22.2, -1.6, -22.5])
    .fill(0xecf0f1);

  // Stance legs & cuffed ranger boots
  body
    .poly([-5.2, -6.5, -1.4, -6.5, -1.8, -2.5, -5.4, -2.5])
    .fill(0x2c3e50)
    .poly([1.2, -6.5, 4.8, -6.5, 5.2, -2.5, 1.8, -2.5])
    .fill(0x233140)
    .rect(-5.6, -3, 4.2, 3.2)
    .fill(0x5d4037)
    .stroke({ width: 0.8, color: 0x2c1a0e })
    .rect(1.6, -3, 4.2, 3.2)
    .fill(0x4e342e)
    .stroke({ width: 0.8, color: 0x2c1a0e })
    .rect(-5.2, -4.4, 3.4, 1.5)
    .fill(level >= 2 ? GOLD_TRIM : 0x85929e)
    .rect(2, -4.4, 3.4, 1.5)
    .fill(level >= 2 ? GOLD_TRIM : 0x5d6d7e);

  // Layered brigandine tunic, cross-strap & belt buckle
  body
    .poly([-6, -15.5, 6, -15.5, 6.8, -5, -6.8, -5])
    .fill(tunicColor)
    .stroke({ width: 1.2, color: 0x145a32 })
    .poly([0, -15.5, 6, -15.5, 6.8, -5, 0, -5])
    .fill({ color: 0x145a32, alpha: 0.34 })
    .poly([-2.5, -15.5, 2.5, -15.5, 0, -12])
    .fill(0x1b2631)
    .moveTo(-4.5, -15)
    .lineTo(4.8, -7.8)
    .stroke({ width: 2, color: 0x5d4037 })
    .rect(-6.8, -8.5, 13.6, 2.2)
    .fill(0x4a2310)
    .rect(-1.8, -8.8, 3.6, 2.8)
    .fill(trimColor);

  // Leading shoulder pauldron
  body
    .poly([-7.8, -15.6, -3.2, -16.4, -3.2, -12, -8.2, -12.6])
    .fill(level >= 2 ? 0x1e8449 : 0x784212)
    .stroke({ width: 1, color: trimColor });

  if (level >= 3) {
    body.circle(0, -11.5, 1.6).fill(GOLD_TRIM);
  }

  // Sculpted face, eyes & deep-cowled ranger hood
  body
    .circle(0.5, -18.5, 4.6)
    .fill(SKIN_COLOR)
    .stroke({ width: 0.9, color: 0x8e5403 })
    .poly([-3.2, -17.2, 4.4, -17.2, 1, -14.2])
    .fill({ color: 0xd5a073, alpha: 0.55 })
    .circle(2.5, -18.7, 1.0)
    .fill(0xffffff)
    .circle(2.8, -18.7, 0.55)
    .fill(0x1b2631)
    .moveTo(0.8, -20.2)
    .lineTo(3.8, -19.5)
    .stroke({ width: 0.9, color: 0x5d4037 })
    .poly([-5.6, -18, -3, -24, 4.8, -21, 3.8, -18.8, -1.2, -20.5])
    .fill(0x0b2d18)
    .poly([-6.5, -17.5, -4, -25.8, 1.8, -25.2, 5.8, -20.5, 1.5, -21.2, -3.2, -19.5])
    .fill(cloakColor)
    .stroke({ width: 1.2, color: level >= 2 ? GOLD_TRIM : 0x145a32 })
    .poly([-3.6, -25, 1.4, -24.8, -1.4, -22.2])
    .fill({ color: cloakHighlight, alpha: 0.65 });

  if (level >= 2) {
    body
      .moveTo(-2, -22)
      .lineTo(4.6, -20.3)
      .stroke({ width: 1.3, color: GOLD_TRIM });
  }

  // Hawk/Phoenix feather plume on hood
  const plumeColor = level >= 3 ? GOLD_TRIM : level === 2 ? 0xf7dc6f : 0x58d68d;
  body
    .poly([-2.4, -24.4, -8.8, -28.6, -4.2, -23.4])
    .fill(plumeColor)
    .stroke({ width: 0.8, color: 0x145a32 });
  if (level >= 3) {
    body.poly([-3.2, -25.2, -10, -27, -5.5, -23.5]).fill(0xe74c3c);
  }
}

export function drawArcherWeapon(
  weapon: Graphics,
  level: number,
  drawPull = 0,
  hasArrow = true,
): void {
  const bowMain =
    level >= 4
      ? MYTHIC_CYAN
      : level >= 3
        ? GOLD_TRIM
        : level === 2
          ? 0x58d68d
          : 0xa04000;
  const bowAccent = level >= 3 ? 0xfdfefe : level === 2 ? 0xd5dbdb : 0xd35400;
  const stringColor = level >= 3 ? 0xf9e79f : 0xecf0f1;
  const nockX = -2.2 - drawPull;
  const tipX = nockX + 12.2;

  weapon.clear();

  // Dynamic bowstring
  weapon
    .moveTo(0.2, -10.2)
    .lineTo(nockX, 0)
    .lineTo(0.2, 10.2)
    .stroke({ width: 1.1, color: stringColor });

  // Sculpted composite recurve bow limbs & central grip
  weapon
    .moveTo(0, -10.6)
    .lineTo(2.4, -7.8)
    .lineTo(4.6, -4.2)
    .lineTo(4.6, 4.2)
    .lineTo(2.4, 7.8)
    .lineTo(0, 10.6)
    .stroke({ width: 2.5, color: bowMain })
    .moveTo(2.2, -7.5)
    .lineTo(4.2, -4)
    .moveTo(2.2, 7.5)
    .lineTo(4.2, 4)
    .stroke({ width: 1.1, color: bowAccent })
    .rect(3.0, -2.8, 3.0, 5.6)
    .fill(0x4a2310)
    .stroke({ width: 0.8, color: level >= 2 ? GOLD_TRIM : 0x2c1a0e });

  // Forward bow-holding hand
  weapon.circle(4.2, 0, 1.8).fill(0x5d4037);

  if (hasArrow) {
    const shaftColor = level >= 3 ? 0xf9e79f : level === 2 ? 0xabebc6 : 0xf4f6f7;
    const headColor = level >= 2 ? GOLD_TRIM : 0xd5dbdb;
    const fletchColor = level >= 3 ? 0xe74c3c : 0x58d68d;

    // Drawing hand pulling string
    weapon
      .circle(nockX, 0, 1.7)
      .fill(0x784212)
      .stroke({ width: 0.8, color: 0x3b1800 });

    // Feathered tail, shaft & broadhead tip
    weapon
      .poly([nockX, 0, nockX - 2.6, -2.0, nockX + 1.4, -0.5])
      .fill(fletchColor)
      .poly([nockX, 0, nockX - 2.6, 2.0, nockX + 1.4, 0.5])
      .fill(fletchColor)
      .moveTo(nockX, 0)
      .lineTo(tipX, 0)
      .stroke({ width: 1.5, color: shaftColor })
      .poly([tipX + 4.2, 0, tipX - 0.8, -2.4, tipX + 0.5, 0, tipX - 0.8, 2.4])
      .fill(headColor)
      .stroke({ width: 0.7, color: 0x1b2631 });

    if (drawPull > 0.5) {
      weapon
        .circle(tipX + 2.5, 0, 1.5 + drawPull * 0.35)
        .fill({ color: level >= 3 ? GOLD_TRIM : 0x58d68d, alpha: 0.45 });
    }
  }
}

function drawKnight(body: Graphics, weapon: Graphics, level: number): void {
  const plateLight = level >= 3 ? 0xd5dbdb : 0xb0bec5;
  const plateMid = level >= 3 ? 0x95a5a6 : 0x85929e;
  const tabardColor = level >= 3 ? 0x2e86c1 : 0x2471a3;
  const trimColor = level >= 2 ? GOLD_TRIM : 0xd6eaf8;
  const capeColor = level >= 3 ? 0x7b241c : 0x154360;

  // Flowing royal mantle (back layer)
  body
    .poly([-4, -15.5, -11.5, -4, -6.5, -1, -1.5, -3.5])
    .fill(capeColor)
    .stroke({ width: 1, color: 0x0b1d2c });
  if (level >= 2) {
    body
      .moveTo(-11.2, -4)
      .lineTo(-6.5, -1.2)
      .stroke({ width: 1.5, color: GOLD_TRIM });
  }

  // Armored sabatons & greaves
  body
    .rect(-5.5, -6, 3.8, 6)
    .fill(0x4d5b68)
    .stroke({ width: 0.9, color: 0x1b2631 })
    .rect(1.7, -6, 3.8, 6)
    .fill(0x3b4854)
    .stroke({ width: 0.9, color: 0x1b2631 })
    .rect(-5.5, -5.5, 1.6, 5)
    .fill(plateMid)
    .circle(-3.6, -5.8, 1.7)
    .fill(level >= 2 ? GOLD_TRIM : plateLight)
    .circle(3.6, -5.8, 1.7)
    .fill(level >= 2 ? GOLD_TRIM : plateMid);

  // Steel cuirass, heraldic tabard & belt
  body
    .poly([-7.5, -16, 7.5, -16, 6.2, -7.5, -6.2, -7.5])
    .fill(plateMid)
    .stroke({ width: 1.2, color: 0x1b2631 })
    .poly([-7.5, -16, 0, -16, 0, -7.5, -6.2, -7.5])
    .fill(plateLight)
    .poly([-6.5, -8.5, 6.5, -8.5, 7.5, -2.8, 1.2, -2.8, 0, -6.2, -1.2, -2.8, -7.5, -2.8])
    .fill(tabardColor)
    .stroke({ width: 1.1, color: 0x154360 })
    .rect(-1.2, -15.5, 2.4, 9)
    .fill(trimColor)
    .rect(-6.8, -8.8, 13.6, 2.2)
    .fill(0x4a2310)
    .rect(-1.8, -9.2, 3.6, 2.8)
    .fill(GOLD_TRIM);

  // Articulated shoulder pauldrons
  body
    .poly([-9.2, -13.2, -7.5, -16.8, -3.4, -15.8, -3.6, -11.5])
    .fill(plateLight)
    .stroke({ width: 1.1, color: level >= 2 ? GOLD_TRIM : 0x1b4f72 })
    .poly([9.2, -13.2, 7.5, -16.8, 3.4, -15.8, 3.6, -11.5])
    .fill(plateMid)
    .stroke({ width: 1.1, color: level >= 2 ? GOLD_TRIM : 0x1b4f72 });

  // Crusader greathelm & sweeping crest plume
  body
    .poly([-5.2, -23.5, 0, -25.8, 5.2, -23.5, 4.8, -15.5, -4.8, -15.5])
    .fill(plateMid)
    .stroke({ width: 1.2, color: 0x1b2631 })
    .poly([-5.2, -23.5, 0, -25.8, 0, -15.5, -4.8, -15.5])
    .fill(plateLight)
    .rect(-1.0, -24.8, 2.0, 9.0)
    .fill(level >= 2 ? GOLD_TRIM : 0x566573)
    .rect(-4.6, -21.2, 9.2, 2.2)
    .fill(level >= 2 ? GOLD_TRIM : 0x566573)
    .rect(-3.4, -20.6, 7.0, 1.7)
    .fill(0x1b2631);

  if (level >= 3) {
    body
      .circle(-1.2, -19.8, 0.8)
      .fill(0xf9e79f)
      .circle(1.8, -19.8, 0.8)
      .fill(0xf9e79f);
  }

  const plumeColor = level >= 3 ? GOLD_TRIM : level === 2 ? 0x5dade2 : 0x3498db;
  body
    .poly([-1.5, -25.5, -9.2, -30.2, -6.8, -24.2, 1.5, -25.2])
    .fill(plumeColor)
    .stroke({ width: 0.9, color: 0x1b2631 });
  if (level >= 3) {
    body
      .poly([-2.5, -26.2, -10.5, -28.5, -6.5, -24.5])
      .fill(0xc0392b)
      .poly([-3.5, -25, 0, -27.2, 3.5, -25])
      .fill(GOLD_TRIM);
  }

  // Ornate kite shield on off-hand side
  body
    .poly([-13, -16.5, -4.2, -16.5, -4.2, -8, -8.6, -3.2, -13, -8])
    .fill(0x1b4f72)
    .stroke({ width: 1.5, color: trimColor })
    .poly([-12.2, -15.8, -8.6, -15.8, -8.6, -4.4, -12.2, -8.2])
    .fill(tabardColor)
    .moveTo(-8.6, -15.2)
    .lineTo(-8.6, -4.8)
    .moveTo(-11.8, -11.5)
    .lineTo(-5.4, -11.5)
    .stroke({ width: 1.4, color: trimColor })
    .circle(-8.6, -11.5, 1.4)
    .fill(GOLD_TRIM);

  // Sculpted paladin broadsword (vertical pointing up from gauntlet pivot)
  const bladeLeft = level >= 4 ? MYTHIC_CYAN : level >= 3 ? 0xf9e79f : 0xfdfefe;
  const bladeRight =
    level >= 4
      ? 0x5dade2
      : level >= 3
        ? 0xf5b041
        : level === 2
          ? 0x85c1e9
          : 0xb0bec5;
  weapon
    .rect(-1.2, 0.5, 2.4, 4.2)
    .fill(0x5d4037)
    .poly([-2, 4.8, 0, 7.2, 2, 4.8, 0, 3.6])
    .fill(GOLD_TRIM)
    .poly([-5.2, -1.2, -2.5, -2.2, 2.5, -2.2, 5.2, -1.2, 3.8, 0.6, -3.8, 0.6])
    .fill(GOLD_TRIM)
    .stroke({ width: 0.8, color: 0x4a2310 })
    .poly([-2.1, -1.8, -1.7, -15.8, 0, -19.8, 0, -1.8])
    .fill(bladeLeft)
    .poly([0, -1.8, 0, -19.8, 1.7, -15.8, 2.1, -1.8])
    .fill(bladeRight)
    .poly([-2.1, -1.8, -1.7, -15.8, 0, -19.8, 1.7, -15.8, 2.1, -1.8])
    .stroke({ width: 1, color: level >= 2 ? 0x5dade2 : 0x566573 })
    .moveTo(0, -3)
    .lineTo(0, -14.5)
    .stroke({ width: 0.9, color: level >= 3 ? 0xffffff : 0x7f8c8d })
    .circle(0, 0, 2.0)
    .fill(0x85929e)
    .stroke({ width: 0.8, color: 0x1b2631 })
    .circle(0, -0.8, 1.1)
    .fill(0x5dade2);
}

function drawMage(body: Graphics, weapon: Graphics, level: number): void {
  const robeDark = level >= 3 ? 0x4a235a : 0x3b154a;
  const robeMid = level >= 3 ? 0x7d3c98 : 0x6c3483;
  const stoleColor = level >= 2 ? 0xa569bd : 0x8e44ad;
  const trimColor = level >= 2 ? GOLD_TRIM : 0xd2b4de;
  const orbColor = level >= 3 ? 0xf9e79f : 0xd980fa;

  // Deep astral-violet back mantle & flared arcane collar
  body
    .poly([-4.5, -16, -11, -2.5, -6, -0.5, -1, -2.5])
    .fill(robeDark)
    .stroke({ width: 1, color: 0x240b30 })
    .poly([-7, -15.5, -8.8, -21.2, -3, -18, 3, -18, 8.8, -21.2, 7, -15.5])
    .fill(0x5b2c6f)
    .stroke({ width: 1.1, color: trimColor });

  // Pleated archmage robes, rune stole & sash
  body
    .poly([-6.8, -15.5, 6.8, -15.5, 9.5, -1.2, -9.5, -1.2])
    .fill(robeMid)
    .stroke({ width: 1.2, color: 0x2c113a })
    .poly([0, -15.5, 6.8, -15.5, 9.5, -1.2, 0, -1.2])
    .fill({ color: 0x2c113a, alpha: 0.28 })
    .poly([-2.4, -15.5, 2.4, -15.5, 3.6, -1.5, -3.6, -1.5])
    .fill(stoleColor)
    .rect(-6.8, -9.2, 13.6, 2.2)
    .fill(trimColor)
    .rect(-1.8, -9.5, 3.6, 2.8)
    .fill(GOLD_TRIM);

  if (level >= 2) {
    body
      .moveTo(-9, -1.5)
      .lineTo(9, -1.5)
      .stroke({ width: 1.5, color: GOLD_TRIM })
      .circle(-5.2, -14.8, 1.5)
      .fill(GOLD_TRIM)
      .circle(5.2, -14.8, 1.5)
      .fill(GOLD_TRIM);
  }

  // Chained mini spellbook at left hip
  body
    .rect(-8.4, -8.2, 4.4, 5.2)
    .fill(0x5d4037)
    .stroke({ width: 0.9, color: GOLD_TRIM })
    .rect(-6.8, -7.2, 1.6, 3)
    .fill(GOLD_TRIM);

  // Off-hand casting palm & floating arcane focus orb
  body
    .circle(-9.2, -12.5, 1.7)
    .fill(SKIN_COLOR)
    .circle(-9.6, -16.8, 4.2)
    .fill({ color: orbColor, alpha: 0.28 })
    .circle(-9.6, -16.8, 2.3)
    .fill(orbColor)
    .circle(-9.6, -16.8, 1.0)
    .fill(0xffffff);

  // Face, glowing arcane eyes, silver beard & sculpted crooked wizard hat
  body
    .circle(0, -18.5, 4.5)
    .fill(SKIN_COLOR)
    .stroke({ width: 0.9, color: 0x8e5403 })
    .circle(-1.2, -19.2, 0.9)
    .fill(level >= 3 ? 0xf9e79f : 0x85c1e9)
    .circle(1.8, -19.2, 0.9)
    .fill(level >= 3 ? 0xf9e79f : 0x85c1e9)
    .poly([-4.2, -16.8, 4.2, -16.8, 2.4, -11.5, 0, -9.8, -2.4, -11.5])
    .fill(0xd5dbdb)
    .poly([-2.4, -16.8, 2.4, -16.8, 0, -10.8])
    .fill(0xfdfefe)
    .ellipse(0, -21.5, 9.5, 2.6)
    .fill(robeDark)
    .stroke({ width: 1.1, color: trimColor })
    .poly([-5.6, -21.5, -2.2, -29.5, 2.5, -33, 1.4, -27.2, 5.6, -21.5])
    .fill(0x5b2c6f)
    .stroke({ width: 1.2, color: trimColor })
    .rect(-4.6, -23.3, 9.2, 1.8)
    .fill(GOLD_TRIM);

  if (level >= 3) {
    body
      .poly([0, -28.2, 1.2, -25.8, 3.6, -25.5, 1.6, -24.2, 2.2, -21.8, 0, -23.2, -2.2, -21.8, -1.6, -24.2, -3.6, -25.5, -1.2, -25.8])
      .fill(GOLD_TRIM);
  }

  // Crescent archmage staff & levitating crystal
  const crystalColor =
    level >= 4
      ? MYTHIC_CYAN
      : level >= 3
        ? 0xf9e79f
        : level === 2
          ? 0xe8daef
          : 0xd980fa;
  const glowColor =
    level >= 4 ? MYTHIC_VIOLET : level >= 3 ? GOLD_TRIM : 0xbb8fce;
  weapon
    .rect(-1.4, -13, 2.8, 21)
    .fill(0x5d4037)
    .stroke({ width: 0.8, color: 0x3e2723 })
    .rect(-1.7, -13.5, 3.4, 2.2)
    .fill(GOLD_TRIM)
    .rect(-1.7, -4, 3.4, 1.8)
    .fill(GOLD_TRIM)
    .poly([-5.5, -19.5, -2.6, -13.5, 2.6, -13.5, 5.5, -19.5, 3.6, -15.8, 0, -14.2, -3.6, -15.8])
    .fill(GOLD_TRIM)
    .stroke({ width: 0.8, color: 0x7d4a02 })
    .circle(0, -19.5, 6.2)
    .fill({ color: glowColor, alpha: 0.28 })
    .poly([0, -24.2, 4.0, -19.5, 0, -14.8, -4.0, -19.5])
    .fill(crystalColor)
    .stroke({ width: 1.1, color: 0xffffff })
    .circle(0, -19.5, 1.5)
    .fill(0xffffff)
    .circle(-4.8, -22, 1.1)
    .fill(glowColor)
    .circle(4.8, -17, 1.1)
    .fill(glowColor);
}

function drawBannerman(body: Graphics, weapon: Graphics, level: number): void {
  const tunicColor = level >= 3 ? 0xc0392b : 0x922b21;
  const trimColor = level >= 4 ? MYTHIC_CYAN : level >= 2 ? GOLD_TRIM : 0xf5b041;
  const plateColor = level >= 3 ? 0xd5dbdb : 0x85929e;
  const clothColor = level >= 4 ? 0xa93226 : level >= 3 ? 0xe74c3c : 0xc0392b;

  // Crimson cape
  body
    .poly([-4, -15.5, -11, -3.5, -6, -1, -1.5, -3.5])
    .fill(0x641e16)
    .stroke({ width: 1, color: 0x3b0d09 });

  // Armored boots & legs
  body
    .rect(-5.2, -6, 3.6, 6)
    .fill(0x4d5b68)
    .rect(1.6, -6, 3.6, 6)
    .fill(0x3b4854);

  // Heraldic surcoat & golden sash
  body
    .poly([-6.8, -15.5, 6.8, -15.5, 7.6, -2.8, -7.6, -2.8])
    .fill(tunicColor)
    .stroke({ width: 1.2, color: 0x4a120c })
    .rect(-1.5, -15.5, 3, 12.2)
    .fill(trimColor)
    .rect(-7, -8.5, 14, 2.2)
    .fill(0x5d4037)
    .rect(-2, -8.8, 4, 2.8)
    .fill(GOLD_TRIM);

  // Shoulder pauldrons & buckler
  body
    .poly([-9, -13, -7.2, -16.5, -3.2, -15.5, -3.5, -11.5])
    .fill(plateColor)
    .stroke({ width: 1, color: trimColor })
    .poly([9, -13, 7.2, -16.5, 3.2, -15.5, 3.5, -11.5])
    .fill(plateColor)
    .stroke({ width: 1, color: trimColor })
    .circle(-8.5, -9.5, 4.4)
    .fill(0x7b241c)
    .stroke({ width: 1.4, color: trimColor })
    .circle(-8.5, -9.5, 1.6)
    .fill(GOLD_TRIM);

  // Head & plumed commander helm
  body
    .circle(0, -18.5, 4.4)
    .fill(SKIN_COLOR)
    .stroke({ width: 0.9, color: 0x8e5403 })
    .poly([-5.2, -20.5, -3.5, -24.5, 3.5, -24.5, 5.2, -20.5])
    .fill(plateColor)
    .stroke({ width: 1.1, color: trimColor })
    .poly([-1, -24.5, -7.5, -29.2, -3.5, -24, 1.5, -24.5])
    .fill(level >= 4 ? MYTHIC_CYAN : GOLD_TRIM)
    .stroke({ width: 0.8, color: 0x641e16 });

  // Tall fluttering war banner
  weapon
    .rect(-1.2, -28, 2.4, 34)
    .fill(0x6e2c00)
    .stroke({ width: 0.8, color: 0x3b1800 })
    .poly([0, -32.5, 2.4, -27.5, 0, -25, -2.4, -27.5])
    .fill(trimColor)
    .rect(-4.5, -25.5, 9, 2)
    .fill(GOLD_TRIM)
    .poly([1.2, -24.5, 16, -21, 12, -15, 16, -9, 1.2, -7.5])
    .fill(clothColor)
    .stroke({ width: 1.2, color: trimColor })
    .poly([6, -18.5, 9, -16, 6, -13.5, 3, -16])
    .fill(GOLD_TRIM);
}

function drawMiner(body: Graphics, weapon: Graphics, level: number): void {
  const apronColor = level >= 3 ? 0x9c640c : 0x7e5109;
  const helmetColor = level >= 4 ? MYTHIC_CYAN : level >= 2 ? 0xf5b041 : 0xd4ac0d;
  const lampGlow = level >= 4 ? MYTHIC_CYAN : 0xfff3b0;

  // Gold ore bucket/cart beside boots
  body
    .poly([-14.5, -4, -6.5, -4, -7.5, 2.5, -13.5, 2.5])
    .fill(0x5d4037)
    .stroke({ width: 1, color: 0x2c1a0e })
    .circle(-11.5, -5.2, 2.2)
    .fill(GOLD_TRIM)
    .circle(-9, -4.8, 2.0)
    .fill(0xf9e79f)
    .circle(-10.2, -6.4, 1.6)
    .fill(0xffd166);

  // Sturdy boots & miner overalls
  body
    .rect(-5.2, -5.5, 3.8, 5.5)
    .fill(0x3e2723)
    .rect(1.4, -5.5, 3.8, 5.5)
    .fill(0x3e2723)
    .poly([-6.6, -15, 6.6, -15, 7.2, -4.5, -7.2, -4.5])
    .fill(0x2e4053)
    .stroke({ width: 1.1, color: 0x1b2631 })
    .poly([-4.8, -14.5, 4.8, -14.5, 5.4, -3.5, -5.4, -3.5])
    .fill(apronColor)
    .stroke({ width: 1, color: 0x4a2310 })
    .rect(-6.8, -8, 13.6, 2)
    .fill(0x4a2310)
    .rect(-1.8, -8.3, 3.6, 2.6)
    .fill(GOLD_TRIM);

  // Bearded face & brass headlamp helmet
  body
    .circle(0, -18.2, 4.5)
    .fill(SKIN_COLOR)
    .stroke({ width: 0.9, color: 0x8e5403 })
    .poly([-4, -17, 4, -17, 2.8, -12, 0, -10.5, -2.8, -12])
    .fill(0x8e5403)
    .arc(0, -19.8, 5.8, Math.PI, 0)
    .fill(helmetColor)
    .stroke({ width: 1.1, color: 0x5d4037 })
    .rect(-6.5, -20.5, 13, 2)
    .fill(0x7d4a02)
    .circle(2.5, -22, 3.2)
    .fill({ color: lampGlow, alpha: 0.35 })
    .circle(2.5, -22, 1.8)
    .fill(lampGlow)
    .stroke({ width: 0.8, color: 0x5d4037 });

  // Heavy miner pickaxe
  const metalCol = level >= 4 ? MYTHIC_CYAN : level >= 3 ? 0xfdfefe : 0x95a5a6;
  weapon
    .rect(-1.2, -14, 2.4, 21)
    .fill(0x6e2c00)
    .stroke({ width: 0.8, color: 0x3b1800 })
    .poly([-8.5, -10.5, -3.5, -14.8, 3.5, -14.8, 9.5, -10, 4.2, -12.2, -3.5, -12.2])
    .fill(metalCol)
    .stroke({ width: 1, color: 0x1b2631 });
}

function drawFrostMage(body: Graphics, weapon: Graphics, level: number): void {
  const robeDark = level >= 3 ? 0x1b4f72 : 0x154360;
  const robeMid = level >= 3 ? 0x2e86c1 : 0x2471a3;
  const stoleColor = level >= 2 ? 0x85c1e9 : 0x5dade2;
  const trimColor = level >= 4 ? MYTHIC_VIOLET : level >= 2 ? 0xe0f7ff : 0x7df9ff;
  const crystalColor = level >= 4 ? MYTHIC_VIOLET : 0x7df9ff;

  // Frost mantle & high ice collar
  body
    .poly([-4.5, -16, -11, -2.5, -6, -0.5, -1, -2.5])
    .fill(robeDark)
    .stroke({ width: 1, color: 0x0b2538 })
    .poly([-7, -15.5, -8.5, -21, -3, -18, 3, -18, 8.5, -21, 7, -15.5])
    .fill(0x21618c)
    .stroke({ width: 1.1, color: trimColor });

  // Cryomancer robes & sash
  body
    .poly([-6.8, -15.5, 6.8, -15.5, 9.5, -1.2, -9.5, -1.2])
    .fill(robeMid)
    .stroke({ width: 1.2, color: 0x154360 })
    .poly([-2.4, -15.5, 2.4, -15.5, 3.6, -1.5, -3.6, -1.5])
    .fill(stoleColor)
    .rect(-6.8, -9.2, 13.6, 2.2)
    .fill(trimColor)
    .rect(-1.8, -9.5, 3.6, 2.8)
    .fill(0xffffff);

  // Floating frost orb in off-hand
  body
    .circle(-9.2, -12.5, 1.7)
    .fill(SKIN_COLOR)
    .circle(-9.6, -16.8, 4.2)
    .fill({ color: crystalColor, alpha: 0.3 })
    .circle(-9.6, -16.8, 2.2)
    .fill(crystalColor)
    .circle(-9.6, -16.8, 1)
    .fill(0xffffff);

  // Face, glowing cyan eyes & crystalline crown hood
  body
    .circle(0, -18.5, 4.5)
    .fill(SKIN_COLOR)
    .stroke({ width: 0.9, color: 0x1b4f72 })
    .circle(-1.2, -19, 0.9)
    .fill(0x7df9ff)
    .circle(1.8, -19, 0.9)
    .fill(0x7df9ff)
    .poly([-6, -20.8, 0, -29.5, 6, -20.8])
    .fill(robeDark)
    .stroke({ width: 1.2, color: trimColor })
    .poly([-3.5, -22, 0, -27.5, 3.5, -22])
    .fill(0x85c1e9);

  // Icicle staff & levitating shard
  weapon
    .rect(-1.3, -13, 2.6, 21)
    .fill(0x5dade2)
    .stroke({ width: 0.8, color: 0x1b4f72 })
    .poly([-4.5, -13.5, 0, -15.5, 4.5, -13.5, 0, -11.5])
    .fill(trimColor)
    .circle(0, -19.5, 6)
    .fill({ color: crystalColor, alpha: 0.28 })
    .poly([0, -25.2, 3.6, -19.5, 0, -13.8, -3.6, -19.5])
    .fill(crystalColor)
    .stroke({ width: 1.1, color: 0xffffff })
    .circle(0, -19.5, 1.4)
    .fill(0xffffff);
}
