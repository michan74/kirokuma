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
 * 家具の詳細を生成するためのLLMプロンプト
 * このプロンプトをLLMに投げて、具体的な家具の配置や種類を生成する
 */
export function buildFurnitureGenerationPrompt(
  roomStyle: RoomStyle,
  roomStage: ReturnType<typeof calculateRoomStage>
): string {
  return `You are a room designer for a clay miniature diorama.
Generate detailed furniture arrangement for a young bear's room.

Room Level: ${roomStage.stage}/5 (${roomStage.name})
Furniture Amount Guideline: ${roomStage.furnitureAmount}
Furniture Style: ${roomStyle.furnitureStyle}
Rug: ${roomStyle.rug}

Requirements:
- List specific furniture items appropriate for the room level
- Describe placement and arrangement naturally
- Include small props (shelves, lamp, plants) as appropriate
- Ensure items match the furniture style
- Create a cozy, lived-in feeling

Output format (plain text, suitable for image generation prompt):
- Furniture amount: [specific count or description]
- Furniture style: [description]
- Rug: [description]
- Items: [list specific items]
- Small props: [list specific props]
- Arrangement: [describe natural placement]`;
}

/**
 * 壁紙/床の詳細を生成するためのLLMプロンプト
 * このプロンプトをLLMに投げて、具体的な壁紙と床のデザインを生成する
 */
export function buildWallpaperFloorGenerationPrompt(
  roomStyle: RoomStyle
): string {
  return `You are a room designer for a clay miniature diorama.
Generate detailed wallpaper and floor design for a young bear's room.

Wallpaper Theme: ${roomStyle.wallpaper}
Floor Theme: ${roomStyle.floor}
Overall Style: Clay/polymer texture, pastel colors, cozy atmosphere

Requirements:
- Describe specific patterns, colors, and textures for wallpaper
- Describe specific materials, colors, and textures for floor
- Suggest wall decorations that complement the style
- Ensure color harmony between wallpaper, floor, and overall room theme
- Keep descriptions suitable for clay miniature aesthetic

Output format (plain text, suitable for image generation prompt):
- Wallpaper: [detailed description with colors, patterns, texture]
- Floor: [detailed description with materials, colors, texture]
- Wall decorations: [specific items and placement]
- Color harmony: [how colors work together]`;
}

/**
 * クマの特徴の詳細を生成するためのLLMプロンプト
 * このプロンプトをLLMに投げて、具体的なクマの見た目やポーズを生成する
 */
export function buildBearFeaturesGenerationPrompt(roomStyle: RoomStyle): string {
  return `You are a character designer for a clay miniature diorama. Generate detailed bear character features and pose.

Character Context:
- Outfit Theme: ${roomStyle.outfit}
- Activity: ${roomStyle.activity}
- Expression: ${roomStyle.expression}
- Lighting: ${roomStyle.lighting}

Requirements:
- Describe specific outfit details (colors, style, accessories)
- Describe specific activity and pose in detail
- Describe facial expression and body language
- Describe how lighting affects the scene mood
- Keep the bear young, cute, and fluffy
- Ensure the activity is engaging and natural
- ⚠️ NO FOOD in the scene - bear should be doing activity, not eating

Output format (plain text, suitable for image generation prompt):
=== Bear ===
- Young, cute, fluffy bear
- Outfit: [detailed outfit description]
- Activity: [detailed activity and pose]
- Expression: [detailed facial expression and mood]
- Lighting: [detailed lighting description and mood]`;
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
