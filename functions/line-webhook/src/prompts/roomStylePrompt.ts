import {MealAnalysis, DishCategory, Portion} from "../models";

/** カテゴリごとの重み */
const CATEGORY_WEIGHTS: Record<DishCategory, number> = {
  main: 1.5,
  side: 1.0,
  staple: 0.3,
  soup: 0.5,
};

/** 量ごとの重み */
const PORTION_WEIGHTS: Record<Portion, number> = {
  small: 0.5,
  medium: 1.0,
  large: 1.5,
};

/** 影響度のしきい値 */
const DOMINANT_THRESHOLD = 5.0;

interface IngredientInfluence {
  name: string;
  score: number;
  isDominant: boolean;
}

/**
 * 食材ごとの影響度を計算
 */
function calculateInfluence(meals: MealAnalysis[]): IngredientInfluence[] {
  const scores: Record<string, number> = {};

  for (const meal of meals) {
    for (const dish of meal.dishes) {
      const categoryWeight = CATEGORY_WEIGHTS[dish.category];
      const portionWeight = PORTION_WEIGHTS[dish.portion];
      const dishScore = categoryWeight * portionWeight;

      for (const ingredient of dish.ingredients) {
        scores[ingredient] = (scores[ingredient] || 0) + dishScore;
      }
    }
  }

  return Object.entries(scores)
    .map(([name, score]) => ({
      name,
      score: Math.round(score * 10) / 10,
      isDominant: score >= DOMINANT_THRESHOLD,
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * 食事履歴をフォーマット
 */
function formatMealHistory(meals: MealAnalysis[]): string {
  return meals
    .map((meal) => {
      const dishes = meal.dishes.map((d) => d.name).join(", ");
      return `- ${dishes}`;
    })
    .join("\n");
}

/**
 * Step1: 食事履歴から部屋のスタイルを生成するプロンプト
 * 食材名は渡すが、出力には食材名を含めない
 */
export function buildRoomStylePrompt(meals: MealAnalysis[]): string {
  const mealHistory = formatMealHistory(meals);
  const influences = calculateInfluence(meals);
  const topIngredients = influences.slice(0, 10);
  const dominantItems = influences.filter((i) => i.isDominant);

  return `
You are a creative interior designer. Based on the meal history below, design a room style.

IMPORTANT: Your output should NOT contain any food names or ingredients.
Instead, translate the meal culture/mood into room aesthetics.

=== Meal History (past 7 days) ===
${mealHistory || "No meals yet"}

=== Top Ingredients (for reference only - DO NOT include in output) ===
${topIngredients.map((i) => `- ${i.name}: ${i.score}`).join("\n") || "None"}

=== DOMINANT ingredients (can be expressed as motifs like patterns) ===
${dominantItems.map((i) => i.name).join(", ") || "None"}

=== How to translate meals into style ===
- Japanese food → Japanese traditional style, tatami, warm wood tones
- Italian/Mediterranean → terracotta, warm earth tones, rustic wood
- Healthy/Salad → bright, airy, natural materials, plants
- Comfort food → cozy, warm colors, soft textures
- Chinese food → red accents, lucky motifs, elegant patterns
- If DOMINANT items exist, their shapes can appear as patterns (e.g. tomato → red circular patterns)

=== Output Format (JSON) ===
Respond with ONLY this JSON, no other text:
{
  "roomStyle": "overall style name",
  "wallpaper": "color and pattern description",
  "floor": "material and color",
  "rug": "description or 'none'",
  "furnitureStyle": "style description",
  "outfit": "bear's clothing description",
  "activity": "what the bear is doing (hobby, relaxing, etc.)",
  "expression": "bear's facial expression",
  "lighting": "time of day and lighting mood"
}

Remember: NO FOOD NAMES in the output. Only aesthetic descriptions.
`.trim();
}

/**
 * 食事がない場合のデフォルトスタイル
 */
export function getDefaultRoomStyle() {
  return {
    roomStyle: "Simple cozy",
    wallpaper: "soft cream with subtle texture",
    floor: "light wooden planks",
    rug: "small round cream rug",
    furnitureStyle: "simple and minimal",
    outfit: "plain comfortable sweater",
    activity: "sitting and relaxing",
    expression: "calm and peaceful",
    lighting: "soft natural daylight",
  };
}
