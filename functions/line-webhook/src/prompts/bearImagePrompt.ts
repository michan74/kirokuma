import {MealAnalysis, TrendAnalysis} from "../models";

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
    "⚠️ CRITICAL: NO FOOD, NO TEXT in image.",
    `=== STEP 1: Identify & Remove Previous Bear's Activity Items ===
Look at the reference image. Find what the bear is holding or using:
- Any handheld items
- Any activity-related items near the bear
→ REMOVE all these items from the scene.`,
    `=== STEP 2: Draw New Bear ===
Draw a completely new bear with the following:
${bearFeaturesPart}`,
    `=== STEP 3: Room Changes ===
Keep existing FURNITURE (tables, chairs, shelves, rugs).
Keep existing WALL DECORATIONS (pictures, clocks, posters).
${furnitureChangePart}
${wallFloorChangePart}`,
    COMPOSITION,
    STYLE,
    "⚠️ FINAL CHECK: Old activity items removed? New bear drawn? No food/text in image?",
  ].join("\n\n").trim();
}

/**
 * 過去7日分の食事履歴から家具の変更を決定
 * 累積の傾向を見て、小物→家具→大きい家具と成長
 */
export function buildFurnitureChangePrompt(meals: MealAnalysis[], trendAnalysis?: TrendAnalysis): string {
  const mealHistory = meals.map((m, i) => {
    const ingredients = (m.ingredients ?? []).join(", ");
    const tags = (m.tags ?? []).join(", ");
    const isToday = i === meals.length - 1;
    return `${isToday ? "[TODAY] " : ""}${m.dish ?? "食事"} (${ingredients}) [${tags}]`;
  }).join("\n");

  // 傾向の強さに応じた指示
  let trendGuidance = "";
  if (trendAnalysis) {
    const dishStrength = trendAnalysis.dishes.strength.toUpperCase();
    const trendDishes = trendAnalysis.dishes.trendDishes.join(", ") || "なし";
    const moodTrend = trendAnalysis.textTrends.moodTrend;
    const ingredientTrend = trendAnalysis.textTrends.ingredientTrend;

    trendGuidance = `
=== Detected Trends (from AI analysis) ===
- Dish genre: ${dishStrength} (${trendDishes})
- Mood/atmosphere: ${moodTrend}
- Ingredients: ${ingredientTrend}

Use these trends to guide your design:
- STRONG trend → Bold themed furniture (mushroom stool, fish tank, etc.)
- MEDIUM trend → Subtle themed accents (matching colors, patterns)
- WEAK trend → Keep neutral, don't force a theme
`;
  }

  return `You are a room designer for a cute miniature diorama.
Based on the 7-day meal history, decide what furniture to ADD or REPLACE.

=== Meal History (7 days, oldest to newest) ===
${mealHistory}
${trendGuidance}
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
 * 壁紙・床は部屋の雰囲気を大きく変えるため、慎重に変更
 * 優先順位: mood（雰囲気） > dishes（料理ジャンル） > ingredients（食材）
 */
export function buildWallFloorChangePrompt(meals: MealAnalysis[], trendAnalysis?: TrendAnalysis): string {
  const mealHistory = meals.map((m, i) => {
    const ingredients = (m.ingredients ?? []).join(", ");
    const tags = (m.tags ?? []).join(", ");
    const isToday = i === meals.length - 1;
    return `${isToday ? "[TODAY] " : ""}${m.dish ?? "食事"} (${ingredients}) [${tags}]`;
  }).join("\n");

  // 傾向の強さに基づく変更ルール
  const dishStrength = trendAnalysis?.dishes.strength ?? "weak";
  const overallTrend = dishStrength.toUpperCase() as "STRONG" | "MEDIUM" | "WEAK";

  const changeInstruction = {
    STRONG: "STRONG trend detected → Change BOTH wallpaper AND floor to match the theme!",
    MEDIUM: "MEDIUM trend detected → Change wallpaper OR floor (pick one)",
    WEAK: "WEAK trend detected → Only change wall decor (clock, picture, shelf)",
  }[overallTrend];

  // 傾向の詳細
  let trendDetails = "";
  if (trendAnalysis) {
    const trendDishes = trendAnalysis.dishes.trendDishes.join(", ") || "なし";
    const moodTrend = trendAnalysis.textTrends.moodTrend;
    const ingredientTrend = trendAnalysis.textTrends.ingredientTrend;

    trendDetails = `
=== Detected Trends ===
- Dish genre: ${dishStrength.toUpperCase()} (${trendDishes})
- Mood/atmosphere: ${moodTrend} ← PRIMARY influence on wall/floor
- Ingredients: ${ingredientTrend} ← Only use if dish trend is STRONG
`;
  }

  return `You are a room designer for a cute miniature diorama.
Based on the 7-day meal history, decide what wall/floor to CHANGE.

=== Meal History (7 days, oldest to newest) ===
${mealHistory}
${trendDetails}
=== Overall Trend: ${overallTrend} ===
${changeInstruction}

=== IMPORTANT: Design Priority ===
1. FIRST: Use mood/atmosphere (cozy → warm colors, elegant → refined textures)
2. SECOND: Use dish genre (Japanese → natural wood, Italian → terracotta)
3. LAST: Use ingredient motifs ONLY if dish trend is STRONG
   - GOOD: abstract patterns, colors, textures
   - BAD: literal pictures of food

=== Elements to Change ===
- Wallpaper: pattern, color, texture (based on mood first!)
- Floor: material, color, pattern
- Wall decor: clock, picture, shelf, window, poster

=== Output Format ===
Based on the ${overallTrend} trend, pick changes:
- Wallpaper: [style based on mood/genre, NOT direct food imagery]
- Floor: [style based on mood/genre]
- Wall decor: [add or replace item]`;
}


/**
 * 今回の食事からクマの服装/活動を決定
 */
export function buildBearFeaturesPromptFromMeal(meal: MealAnalysis): string {
  const ingredients = meal.ingredients.join(", ");
  const tags = meal.tags.join(", ");

  return `You are a character designer for a clay miniature diorama.
Based on this meal, imagine: "After eating this, what would the bear want to do in their room today?"

=== Today's Meal ===
${meal.dish} (${ingredients})
Tags: ${tags}

=== Think about ===
- What mood does this meal give?
- What activity fits that mood?

⚠️ CRITICAL: Bear should NOT be eating or cooking. Choose ONE simple activity.
⚠️ DO NOT mention food names in output.

=== Output Format ===
- Outfit: [outfit that matches today's mood]
- Activity: [ONE simple activity - what does the bear want to do today?]
- Remove from previous: [items to DELETE from the reference image - handheld items, activity items near the bear]
- Add for this activity: [NEW items the bear needs for this activity]
- Lighting: [lighting that matches the mood]`;
}
