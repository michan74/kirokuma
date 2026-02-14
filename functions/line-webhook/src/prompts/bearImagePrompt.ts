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

  return `You are a room designer for a cute miniature diorama.
Based on the 7-day meal history, decide what furniture to ADD or REPLACE.

=== Meal History (7 days, oldest to newest) ===
${mealHistory}

=== Design Philosophy ===
- Look at ALL 7 days - find repeated ingredients or tags
- Repeated items = stronger influence on furniture style!
  - Example: "mushroom" appears 3 times → mushroom-themed furniture
  - Example: "cozy" tag appears often → warm, soft furniture
- Be creative and playful, like Animal Crossing furniture

=== Growth Rules ===
Based on the CUMULATIVE meal history:
- Few meals (1-2): Add small items only
- Some meals (3-5): Can add small furniture
- Many meals (5-7): Can add medium furniture
- Lots of meals (7+): Can add large furniture

=== Room Space ===
- The room is SMALL - only space for 3-5 items total
- If room is full, REPLACE an old item instead of adding

=== Output Rules ===
- 1 action per meal (Add or Replace)
- Furniture should reflect the DOMINANT ingredients/tags from history
- DO NOT mention food names directly

=== Output Format ===
- Add: [item inspired by dominant ingredients/tags] OR
- Replace: [old item] → [new item that better reflects meal history]`;
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

  return `You are a room designer for a cute miniature diorama.
Based on the 7-day meal history, decide what wall/floor to CHANGE.

=== Meal History (7 days, oldest to newest) ===
${mealHistory}

=== Design Philosophy ===
- Look at ALL 7 days - find repeated ingredients or tags
- Repeated items = stronger influence on wall/floor style!
  - Example: "fish" appears often → ocean-themed wallpaper, sandy floor
  - Example: "cozy" tag repeated → warm colors, soft textures
- Be creative! Like Animal Crossing room themes

=== Elements to Change ===
- Wallpaper: pattern, color, theme (can be playful!)
- Floor: material, color, pattern
- Wall decor: clock, picture, shelf, window, poster

=== Change Rules (based on trend strength) ===
- STRONG trend (same tags/ingredients appear 4+ times): Change wallpaper AND floor
- MEDIUM trend (same tags/ingredients appear 2-3 times): Change wallpaper OR floor
- WEAK trend (no clear pattern): Only change wall decor (clock, picture, shelf)

=== Output Format ===
Pick 1-2 changes inspired by the meal history:
- Wallpaper: [new style reflecting dominant ingredients/tags]
- Floor: [new style reflecting dominant ingredients/tags]
- Wall decor: [add or replace item]`;
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
