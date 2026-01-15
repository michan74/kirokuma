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

=== CONCEPT ===
This is a magical bear that TRANSFORMS based on what it eats.
When the bear eats food, the food's essence is absorbed into the bear's body and changes its appearance.
The bear doesn't hold or eat food in the image - instead, the food has ALREADY been eaten and transformed the bear.

=== INSTRUCTIONS ===
Show the bear AFTER it has eaten and absorbed the meal:

1. FUR COLOR: The meal's colors have dyed the bear's fur
2. BODY SHAPE: The nutrition affects the bear's physique (protein = muscular, carbs = chubby and happy, etc.)
3. EXPRESSION & MOOD: Reflects how the food made the bear feel
4. MAGICAL TRANSFORMATIONS: The food's essence manifests as physical changes:
   - Eating spicy food → steam coming from ears, red cheeks
   - Eating fish → fish-shaped tail or fins
   - Eating vegetables → leaf patterns on fur, flower accessories growing from body
   - Eating sweets → sparkly fur, candy-colored patches
   - Be creative with how the food transforms the bear!

IMPORTANT:
- Do NOT show the bear holding food
- Do NOT show food items in the image
- The bear has ALREADY eaten - show the RESULT of eating

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
