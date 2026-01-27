import {MealAnalysis} from "../models";

/**
 * 共通部分
 */
const STYLE = `
Style:
- Kawaii/cute cartoon style
- Simple and adorable design
- Flat illustration style
- Pastel colors
- No text, no watermark
- Full body bear (not just upper body)
- Random cute pose (sitting, standing, waving, dancing, jumping, etc.)
`.trim();

const RULES = `
Rules:
- No food items in the image
- Bear is not holding or eating anything
`.trim();

function formatMealHistory(meals: MealAnalysis[]): string {
  return meals
    .map((meal) => `- ${meal.menuName} (${meal.ingredients.join(", ")})`)
    .join("\n");
}

/**
 * くま画像生成用プロンプト
 * 過去7日分の食事履歴からくまを生成
 */
export function buildBearPrompt(meals: MealAnalysis[]): string {
  const mealHistory = formatMealHistory(meals);

  return `
Generate a cute bear character illustration based on the meals this bear has eaten.

=== Meal History (past 7 days) ===
${mealHistory}

=== Concept ===
This magical bear's appearance is shaped by what it eats.
Look at the meal history above and create a bear that reflects these foods.
Be creative! The bear's colors, patterns, body shape, and features should be inspired by the ingredients and dishes.

=== Examples of how meals might influence the bear ===
- Salmon → pink/orange tinted fur, fish-shaped patterns
- Curry → warm golden colors, spicy energetic expression
- Salad → fresh green accents, slim healthy body
- Ramen → warm cozy feeling, round satisfied belly
- Sushi → elegant appearance, ocean-inspired colors

${RULES}

${STYLE}
`.trim();
}
