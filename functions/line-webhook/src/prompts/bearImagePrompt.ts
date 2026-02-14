import {MealAnalysis} from "../models";

// 構図
const COMPOSITION = `
⚠️ COMPOSITION (MUST FOLLOW):
- Straight-on front view: The camera is leveled and faces the center corner directly.
- V-shaped room layout: Only two walls are visible (left and right), meeting at a center vertical line.
- Dollhouse cutaway: A cross-section view like a theater stage with the front walls removed.
- Symmetrical composition: Balanced view of the floor and the two meeting walls.
- ❌ STRICTLY NO Isometric view: No tilted or diagonal bird's-eye angles.
`.trim();

/**
 * スタイル定義 - 粘土ミニチュア風の部屋
 */
const STYLE = `
Style:
- Miniature diorama inside a glass dome/snow globe
- Realistic textures with soft, diffused lighting
- Clean, minimalist aesthetic with detailed materials
- NO TEXT, NO WATERMARK anywhere
`.trim();

// const IMAGE_CONSTRAINTS = `
// Image constraints (MUST FOLLOW):
// - Do NOT change the canvas dimensions or add borders/margins/padding to the canvas.
// - Preserve the reference image size exactly. Output should use the same canvas size.
// - Allow the bear to be positioned freely in the room. Examples:
//   - left, right, near the window
//   - lying on the floor, on the bed
//   - jumping, bathing, playing
// - The bear must remain fully visible within the canvas (no cropping of the subject).
// - Keep the subject reasonably large so it is the focal point.
//   - Exact centering is NOT required.
// - If the bear is positioned off-center, adjust background elements subtly (scale/shift).
// - Do NOT add transparent padding, borders, or extend the canvas.
// - Treat the provided reference image as a strict layout template for camera angle and perspective.
//   Only modify contents inside the scene (objects, bear pose, scale); do not change camera geometry.
// `.trim();

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
    furnitureAmount: "Nearly empty - only 1-2 small items",
  },
  2: {
    name: "少し落ち着いた",
    furnitureAmount: "3-4 items (basic furniture and small decorations)",
  },
  3: {
    name: "生活感が出てきた",
    furnitureAmount: "5-6 items (furniture, decorations, and lighting)",
  },
  4: {
    name: "充実してきた",
    furnitureAmount: "7-8 items (full furniture set with wall decorations)",
  },
  5: {
    name: "こだわりの空間",
    furnitureAmount: "10+ items (fully furnished with personal collections)",
  },
};

/**
 * 食事回数から部屋の充実度を計算
 */
export function calculateRoomStage(mealCount: number): RoomStageInfo {
  let stage: RoomStage;
  if (mealCount <= 3) {
    stage = 1;
  } else if (mealCount <= 7) {
    stage = 2;
  } else if (mealCount <= 14) {
    stage = 3;
  } else if (mealCount <= 28) {
    stage = 4;
  } else {
    stage = 5;
  }
  return {stage, ...ROOM_STAGES[stage]};
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
    // IMAGE_CONSTRAINTS,
    "⚠️ REMINDER: NO FOOD, NO TEXT. FRONT VIEW with 3 walls visible. Bear doing activity.",
  ].join("\n\n").trim();
}

/**
 * 食事履歴から直接家具プロンプトを生成
 * JSON形式でFurnitureItem[]を返すように指示する
 */
export function buildFurnitureGenerationPromptFromMeals(
  meals: MealAnalysis[],
  roomStage: ReturnType<typeof calculateRoomStage>
): string {
  const mealHistory = meals.map((m) => {
    const dishes = m.dishes.map((d) => d.name).join(", ");
    return `- ${dishes}`;
  }).join("\n");

  return `You are a room designer for a clay miniature diorama.
Based on the meal history, design detailed furniture for a young bear's room.

=== Meal History (past 7 days) ===
${mealHistory || "No meals yet"}

=== Room Level ===
${roomStage.stage}/5 (${roomStage.name})
Furniture Amount: ${roomStage.furnitureAmount}

=== Translation Rules ===
- Japanese food → Low wooden furniture (ちゃぶ台, 座布団), tatami patterns, warm wood tones
- Italian/Western → Mediterranean style, rustic wood tables, terracotta colors
- Healthy/Salad → Natural materials, light wood, plants as decor
- Comfort food → Cozy furniture, soft cushions, warm textiles
- Chinese food → Red/gold accents, elegant carved details

⚠️ IMPORTANT: DO NOT mention food names in output. Translate meal culture to furniture style.

=== Output Format (JSON array) ===
Respond with ONLY a JSON array, no other text:
[
  {
    "type": "furniture type (e.g. ちゃぶ台, ソファ, ベッド)",
    "pattern": "pattern description (optional, e.g. 魚柄, 波柄)",
    "color": "color (optional, e.g. 赤, 青)",
    "placement": "where in the room (optional, e.g. 部屋の中央, 窓際)",
    "items": ["items on top of this furniture (optional)", "e.g. ノート, 本, 鍋"]
  }
]

Generate ${roomStage.furnitureAmount} based on the meal culture.
Include a rug if appropriate for the style.`;
}

/**
 * 食事履歴から直接壁紙/床プロンプトを生成
 */
export function buildWallpaperFloorGenerationPromptFromMeals(meals: MealAnalysis[]): string {
  const mealHistory = meals.map((m) => {
    const dishes = m.dishes.map((d) => d.name).join(", ");
    return `- ${dishes}`;
  }).join("\n");

  return `You are a room designer for a clay miniature diorama.
Based on the meal history, design wallpaper and floor for a young bear's room.

=== Meal History (past 7 days) ===
${mealHistory || "No meals yet"}

=== Translation Rules ===
- Japanese food → Soft patterns, tatami or wooden floor, washi paper texture
- Italian/Western → Textured plaster walls, terracotta tiles or warm wood floor
- Healthy/Salad → Light colors, natural textures, botanical patterns
- Comfort food → Warm colors, soft textures, cozy patterns
- Chinese food → Elegant patterns, red/gold accents, decorative borders

⚠️ IMPORTANT: DO NOT mention food names. Translate meal mood to wall/floor aesthetics.

Output format (plain text for image generation):
- Wallpaper: [detailed description with colors, patterns]
- Floor: [detailed description with materials, colors]
- Wall decorations: [subtle art or frames]
- Color harmony: [overall color scheme]`;
}

/**
 * 食事履歴から直接クマの特徴プロンプトを生成
 */
export function buildBearFeaturesGenerationPromptFromMeals(meals: MealAnalysis[]): string {
  const mealHistory = meals.map((m) => {
    const dishes = m.dishes.map((d) => d.name).join(", ");
    return `- ${dishes}`;
  }).join("\n");

  return `You are a character designer for a clay miniature diorama.
Based on the meal history, design a young bear character's appearance and activity.

=== Meal History (past 7 days) ===
${mealHistory || "No meals yet"}

=== Translation Rules ===
- Japanese food → Traditional or casual Japanese-inspired outfit, peaceful activities
- Italian/Western → Casual European style, active/creative activities
- Healthy/Salad → Sporty or natural outfit, energetic activities
- Comfort food → Cozy outfit (sweater, pajamas), relaxing activities
- Chinese food → Elegant outfit with subtle patterns, graceful activities

=== Activity Ideas (NO EATING) ===
- Reading, drawing, playing with toys
- Stretching, dancing, playing music
- Looking out window, watering plants
- Building blocks, organizing shelves
- Relaxing on floor, stargazing

⚠️ CRITICAL: Bear should NOT be eating. Choose non-food activity.
⚠️ DO NOT mention food names. Translate meal culture to outfit/activity style.

Output format (plain text for image generation):
=== Bear ===
- Young, cute, fluffy bear
- Outfit: [detailed outfit based on meal culture]
- Activity: [specific non-food activity with pose details]
- Expression: [facial expression and mood]
- Lighting: [lighting that matches the mood]`;
}
