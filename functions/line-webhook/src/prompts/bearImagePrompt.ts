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
- Clean, minimalist aesthetic with detailed materials
- NO TEXT, NO WATERMARK anywhere

Bear Style (MUST FOLLOW):
- Cute stuffed animal / plush toy style young bear
- Round, chubby body with short limbs
- Soft fluffy brown fur with warm tones
- Small solid black eyes (no whites)
- Small cute nose
- Friendly, huggable appearance
`.trim();

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
    "=== Bear (DRAW NEW, ignore previous bear) ===",
    bearFeaturesPart,
    "=== Room Changes (apply to existing room) ===",
    "Apply the following changes to the room. Keep existing furniture and decorations.",
    furnitureChangePart,
    wallFloorChangePart,
    COMPOSITION,
    STYLE,
    "⚠️ REMINDER: NO FOOD, NO TEXT. Draw bear fresh with new outfit. Keep room frame unchanged.",
  ].join("\n\n").trim();
}

/**
 * 過去7日分の食事履歴から家具の変更を決定
 * 累積の傾向を見て、小物→家具→大きい家具と成長
 */
export function buildFurnitureChangePrompt(meals: MealAnalysis[]): string {
  const mealHistory = meals.map((m, i) => {
    const dishes = m.dishes.map((d) => `${d.name}(${d.ingredients.join(", ")})`).join(", ");
    const tags = m.tags.join(", ");
    const isToday = i === meals.length - 1;
    return `${isToday ? "[TODAY] " : ""}${dishes} [${tags}]`;
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

Match the room's existing style based on the dominant tags in history.

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
    const dishes = m.dishes.map((d) => `${d.name}(${d.ingredients.join(", ")})`).join(", ");
    const tags = m.tags.join(", ");
    const isToday = i === meals.length - 1;
    return `${isToday ? "[TODAY] " : ""}${dishes} [${tags}]`;
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
- Look at the dishes, ingredients, and tags to understand the meal style
- ONLY change wallpaper/floor if the overall style has SHIFTED significantly
- Example: If most meals are Japanese style, keep Japanese walls/floor
- Example: If meals shifted to Italian style, THEN change
- If the style already matches: "No changes" for wallpaper/floor

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
  const dishes = meal.dishes.map((d) => `${d.name}(${d.ingredients.join(", ")})`).join(", ");
  const tags = meal.tags.join(", ");

  return `You are a character designer for a clay miniature diorama.
Based on this meal, imagine: "After eating this, what would the bear want to do in their room today?"

=== Today's Meal ===
${dishes}
Tags: ${tags}

=== Think about ===
- What mood does this meal give? (energetic, relaxed, cozy, playful, creative...)
- What activity fits that mood? (anything the bear can do in a small room)

⚠️ CRITICAL: Bear should NOT be eating or cooking. Choose ONE simple activity.
⚠️ DO NOT mention food names in output.

=== Output Format ===
- Outfit: [casual outfit that matches today's mood]
- Activity: [ONE simple activity - what does the bear want to do today?]
- Expression: [facial expression]
- Lighting: [lighting that matches the mood]`;
}
