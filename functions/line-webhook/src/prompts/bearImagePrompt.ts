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
- Miniature room box with wooden frame edges
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

/**
 * 差分ベースの最終プロンプトを組み立て
 */
export function buildBearImagePromptFromChanges(
  bearFeaturesPart: string,
  furnitureChangePart: string,
  wallFloorChangePart: string
): string {
  return [
    "⚠️ CRITICAL: NO FOOD, NO TEXT in image. No dishes, plates, letters, or words anywhere.",
    "=== Bear ===",
    bearFeaturesPart,
    "=== Room Changes ===",
    "Apply the following changes to the room. Keep everything else as-is.",
    furnitureChangePart,
    wallFloorChangePart,
    COMPOSITION,
    STYLE,
    "⚠️ REMINDER: NO FOOD, NO TEXT. Keep the frame and base unchanged.",
  ].join("\n\n").trim();
}

/**
 * 過去7日分の食事履歴から家具の変更を決定
 * 累積の傾向を見て、小物→家具→大きい家具と成長
 */
export function buildFurnitureChangePrompt(meals: MealAnalysis[]): string {
  const mealHistory = meals.map((m, i) => {
    const dishes = m.dishes.map((d) => d.name).join(", ");
    const isToday = i === meals.length - 1;
    return `${isToday ? "[TODAY] " : ""}${dishes}`;
  }).join("\n");

  return `You are a room designer for a clay miniature diorama.
Based on the meal history, decide what furniture to ADD to the bear's room.

=== Meal History (7 days, oldest to newest) ===
${mealHistory}

=== Translation Rules ===
- Japanese food → Low wooden furniture (ちゃぶ台, 座布団), warm wood tones
- Italian/Western → Mediterranean style, rustic wood tables, terracotta colors
- Healthy/Salad → Natural materials, light wood, plants as decor
- Comfort food → Cozy furniture, soft cushions, warm textiles
- Chinese food → Red/gold accents, elegant carved details

=== Growth Rules ===
Based on the CUMULATIVE meal history:
- Few meals (1-2): Add small items only (cushion, small plant, book)
- Some meals (3-5): Can add small furniture (side table, lamp)
- Many meals (5-7): Can add medium furniture (table, shelf)
- Lots of meals (7+): Can add large furniture (sofa, bed, bookshelf)

Match the room's existing style based on the dominant cuisine in history.

=== Output Rules ===
- Add 1-2 items appropriate for the cumulative meal count
- Match the dominant style from meal history
- Today's meal can influence the specific item choice
- DO NOT mention food names

=== Output Format ===
Respond with a short list:
- Add: [item description with color/style]

Example:
- Add: small wooden side table with warm brown finish`;
}

/**
 * 過去7日分の食事履歴から壁/床の変更を決定
 * 壁紙・床は傾向が大きく変わった時だけ変更
 */
export function buildWallFloorChangePrompt(meals: MealAnalysis[]): string {
  const mealHistory = meals.map((m, i) => {
    const dishes = m.dishes.map((d) => d.name).join(", ");
    const isToday = i === meals.length - 1;
    return `${isToday ? "[TODAY] " : ""}${dishes}`;
  }).join("\n");

  return `You are a room designer for a clay miniature diorama.
Based on the meal history, decide what wall/floor elements to CHANGE or ADD.

=== Meal History (7 days, oldest to newest) ===
${mealHistory}

=== Elements ===
Base elements (RARELY change):
- Wallpaper: pattern, color
- Floor: material, color

Wall-mounted items (can add based on cumulative meals):
- shelf, clock, window, framed picture

=== Translation Rules ===
- Japanese food → Soft patterns, tatami or wooden floor
- Italian/Western → Textured plaster walls, terracotta or warm wood floor
- Healthy/Salad → Light colors, natural textures
- Comfort food → Warm colors, soft textures
- Chinese food → Elegant patterns, red/gold accents

=== IMPORTANT: Wallpaper/Floor Change Rules ===
- ONLY change wallpaper/floor if the dominant cuisine has SHIFTED significantly
- Example: If most meals were Japanese, keep Japanese-style walls/floor
- Example: If meals shifted from Japanese to Italian, THEN change the style
- If the style already matches the dominant cuisine: "No changes" for wallpaper/floor

=== Wall-mounted Items ===
- Can add 0-1 wall items based on cumulative meal count and style
- Keep it minimal

=== Output Format ===
Respond with a short list (or "No changes" if none needed):
- Change wallpaper: [only if style shifted]
- Change floor: [only if style shifted]
- Add [wall item]: [description]

Example (when style matches):
- Add clock: small wooden clock on wall

Example (when style shifted):
- Change wallpaper: warm terracotta texture with subtle pattern`;
}

/**
 * 今回の食事からクマの服装/活動を決定
 */
export function buildBearFeaturesPromptFromMeal(meal: MealAnalysis): string {
  const dishes = meal.dishes.map((d) => d.name).join(", ");

  return `You are a character designer for a clay miniature diorama.
Based on this meal, design a young bear character's appearance and activity.

=== Today's Meal ===
${dishes}

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
⚠️ DO NOT mention food names.

=== Output Format ===
- Outfit: [detailed outfit based on meal culture]
- Activity: [specific non-food activity with pose details]
- Expression: [facial expression and mood]
- Lighting: [lighting that matches the mood]`;
}
