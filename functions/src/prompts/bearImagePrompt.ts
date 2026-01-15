import {BearParameters, MealAnalysis} from "../models";

/**
 * くま画像生成用プロンプトを構築
 * @param params 過去の食事から累積されたパラメータ
 * @param currentMeal 今回の食事分析結果
 */
export function buildBearPrompt(
  params: BearParameters,
  currentMeal: MealAnalysis
): string {
  // 累積された色を文字列化
  const accumulatedColors = formatRecord(params.colors);

  // 累積された栄養素を文字列化
  const accumulatedNutrition = formatRecord(params.nutrition);

  // 累積された特徴（重複あり = 頻度が多いほど強調）
  const accumulatedCharacteristics = params.characteristics.join(", ") || "なし";

  // 今回の食事情報
  const currentColors = formatRecord(currentMeal.colors);
  const currentNutrition = formatRecord(currentMeal.nutrition);
  const currentCharacteristics = currentMeal.characteristics.join(", ");
  const currentIngredients = currentMeal.ingredients.join(", ");

  return `
You are generating a cute bear character illustration.
This bear's appearance is determined by the user's eating habits.

=== ACCUMULATED DATA (Recent eating trends) ===
- Frequent colors in meals: ${accumulatedColors}
- Nutritional balance: ${accumulatedNutrition}
- Meal characteristics: ${accumulatedCharacteristics}

=== TODAY'S MEAL ===
- Menu: ${currentMeal.menuName}
- Ingredients: ${currentIngredients}
- Characteristics: ${currentCharacteristics}
- Colors: ${currentColors}
- Nutrition: ${currentNutrition}

=== INSTRUCTIONS ===
Based on the above meal data, create a unique bear character:

1. FUR COLOR: Use the meal colors to determine the bear's fur color/pattern
2. EXPRESSION & POSE: Reflect the nutritional balance (protein = energetic, carbs = happy, fat = sleepy, etc.)
3. ACCESSORIES & FEATURES: Be creative! Add any features inspired by the food:
   - Accessories (hats, scarves, glasses, etc.)
   - Clothing or patterns
   - Wings, horns, or other fantasy elements
   - Food-themed decorations
   - Anything that represents the meal!

Style requirements:
- Kawaii/cute cartoon style
- Simple and adorable design
- Flat illustration style
- Pastel colors
- White background
- No text, no watermark
`.trim();
}

/**
 * Record<string, number> を "key1 (30%), key2 (25%)" 形式に変換
 */
function formatRecord(record: Record<string, number>): string {
  const entries = Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key} (${value}%)`);

  return entries.length > 0 ? entries.join(", ") : "none";
}
