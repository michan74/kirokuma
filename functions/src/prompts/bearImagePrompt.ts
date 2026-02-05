import {RoomStyle} from "../models";

/**
 * スタイル定義 - 粘土ミニチュア風の部屋
 */
const COMPOSITION = `
⚠️ COMPOSITION (MUST FOLLOW):
- FRONT VIEW ONLY - camera faces the back wall directly
- THREE walls visible: back wall (center) + left wall + right wall
- Floor and ceiling also visible
- Like a theater stage or dollhouse with front wall removed
- ❌ NO diagonal angle, NO corner view, NO isometric view
`.trim();

const STYLE = `
Style:
- Clay/polymer texture, pastel colors, soft cozy lighting
- NO TEXT, NO WATERMARK anywhere
`.trim();

const IMAGE_CONSTRAINTS = `
Image constraints (MUST FOLLOW):
- Do NOT change the canvas dimensions or add borders/margins/padding to the canvas.
- Preserve the reference image size exactly. Output should use the same canvas size.
- Allow the bear to be positioned freely in the room. Examples:
  - left, right, near the window
  - lying on the floor, on the bed
  - jumping, bathing, playing
- The bear must remain fully visible within the canvas (no cropping of the subject).
- Keep the subject reasonably large so it is the focal point.
  - Exact centering is NOT required.
- If the bear is positioned off-center, adjust background elements subtly (scale/shift).
- Ensure the overall composition remains natural and the bear is not tiny.
- Do NOT add transparent padding, borders, or extend the canvas.
- Treat the provided reference image as a strict layout template for camera angle and perspective.
  Only modify contents inside the scene (objects, bear pose, scale); do not change camera geometry.
`.trim();

/** 部屋の充実度段階の定義 */
type RoomStage = 1 | 2 | 3 | 4 | 5;

interface RoomStageInfo {
  stage: RoomStage;
  name: string;
  furnitureAmount: string;
}

const ROOM_STAGES: Record<RoomStage, Omit<RoomStageInfo, "stage">> = {
  1: {
    name: "はじまりの部屋",
    furnitureAmount: "Nearly empty - only TWO small items",
  },
  2: {
    name: "少し落ち着いた",
    furnitureAmount: "Small table, one chair, simple lamp, basic rug",
  },
  3: {
    name: "生活感が出てきた",
    furnitureAmount: "Sofa, shelves, curtains, plants, proper ceiling light",
  },
  4: {
    name: "充実してきた",
    furnitureAmount: "Full furniture set, art on walls, decorative lighting",
  },
  5: {
    name: "こだわりの空間",
    furnitureAmount: "Fully furnished, collections displayed, personal touches everywhere",
  },
};

/**
 * 食事回数から部屋の充実度を計算
 */
export function calculateRoomStage(mealCount: number): RoomStageInfo {
  let stage: RoomStage;
  if (mealCount <= 6) {
    stage = 1;
  } else if (mealCount <= 15) {
    stage = 2;
  } else if (mealCount <= 27) {
    stage = 3;
  } else if (mealCount <= 39) {
    stage = 4;
  } else {
    stage = 5;
  }
  return {stage, ...ROOM_STAGES[stage]};
}

/**
 * Step2: 部屋スタイルからくま画像を生成するプロンプト
 * 食材名は含まれない - RoomStyleのみを使用
 */
export function buildBearImagePrompt(roomStyle: RoomStyle, totalMealCount: number): string {
  const roomStage = calculateRoomStage(totalMealCount);
  // Build modular prompt parts
  const furniturePart = buildFurniturePrompt(roomStyle, roomStage);
  const wallpaperFloorPart = buildWallpaperFloorPrompt(roomStyle);
  const bearFeaturesPart = buildBearFeaturesPrompt(roomStyle);

  return [
    "⚠️ CRITICAL: NO FOOD, NO TEXT in image. No dishes, plates, letters, or words anywhere.",
    "Generate a clay miniature diorama of a young bear's room.",
    bearFeaturesPart,
    `=== Room (Level ${roomStage.stage}/5) ===`,
    furniturePart,
    wallpaperFloorPart,
    COMPOSITION,
    STYLE,
    IMAGE_CONSTRAINTS,
    "⚠️ REMINDER: NO FOOD, NO TEXT. FRONT VIEW with 3 walls visible. Bear doing activity.",
  ].join("\n\n").trim();
}

/**
 * Build prompt for furniture generation (amount, major furniture, decorative items)
 */
export function buildFurniturePrompt(roomStyle: RoomStyle, roomStage: ReturnType<typeof calculateRoomStage>): string {
  return `- Furniture amount: ${roomStage.furnitureAmount}
- Furniture style: ${roomStyle.furnitureStyle}
- Rug: ${roomStyle.rug}
- Suggested items: suggest appropriate items matching the furniture amount and style (e.g. table, chair, sofa)
- Suggested small props: shelves, lamp, plants
- Arrange items naturally for a cozy clay miniature scene`;
}

/**
 * Build prompt for wallpaper and floor generation
 */
export function buildWallpaperFloorPrompt(roomStyle: RoomStyle): string {
  return `- Wallpaper: ${roomStyle.wallpaper}
- Floor: ${roomStyle.floor}
- Wall decorations: subtle art or frames consistent with the room style (optional)
- Color harmony: ensure wallpaper and floor colors complement the bear and furniture`;
}

/**
 * Build prompt for bear appearance and features
 */
export function buildBearFeaturesPrompt(roomStyle: RoomStyle): string {
  return `=== Bear ===
- Young, cute, fluffy bear
- Outfit: ${roomStyle.outfit}
- Activity: ${roomStyle.activity}
- Expression: ${roomStyle.expression}
- Lighting: ${roomStyle.lighting}`;
}

/**
 * Compose final bear image prompt from already-generated detail parts.
 * Each part should be a multi-line instruction suitable for an image model.
 */
export function buildBearImagePromptFromParts(
  bearFeaturesPart: string,
  furniturePart: string,
  wallpaperFloorPart: string,
  roomStage: ReturnType<typeof calculateRoomStage>
): string {
  return [
    "⚠️ CRITICAL: NO FOOD, NO TEXT in image. No dishes, plates, letters, or words anywhere.",
    "Generate a clay miniature diorama of a young bear's room.",
    bearFeaturesPart,
    `=== Room (Level ${roomStage.stage}/5) ===`,
    furniturePart,
    wallpaperFloorPart,
    COMPOSITION,
    STYLE,
    IMAGE_CONSTRAINTS,
    "⚠️ REMINDER: NO FOOD, NO TEXT. FRONT VIEW with 3 walls visible. Bear doing activity.",
  ].join("\n\n").trim();
}
