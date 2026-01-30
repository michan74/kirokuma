import {MealAnalysis, DishCategory, Portion} from "../models";

/**
 * スタイル定義 - 粘土ミニチュア風の部屋
 */
const STYLE = `
Style:
- Clay/polymer clay miniature style
- Soft, handcrafted texture like claymation
- Interior room view only - no exterior visible
- Cozy, dreamy atmosphere
- Pastel and warm color palette
- ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO WATERMARK, NO LABELS anywhere in the image

Composition (VERY IMPORTANT - MUST FOLLOW):
- We are INSIDE the room, not looking at it from outside
- Camera position: inside the room, facing the back wall
- Visible: back wall, left wall, right wall, ceiling, floor - ALL from the INSIDE
- The walls/ceiling/floor extend to the edges of the image
- NO exterior of the room visible - NO outside frame, NO box outline, NO diorama edge
- Think of it as a screenshot from inside a room in a video game
- Flat front view, no diagonal angle
`.trim();

const RULES = `
CRITICAL RULES (MUST FOLLOW):
- NO actual food in the image - no real dishes, plates, or edible items
- NO eating scenes - the bear is doing an ACTIVITY in its room
- The bear must be doing something: hobby, housework, exercise, daily life activity
- Express meals ABSTRACTLY through: colors, cultural style, mood, lifestyle, abstract patterns
- Literal food shapes ONLY for items marked as [DOMINANT] in the influence list
- Bear's fur: soft natural tones with meal-inspired hues (gentle pink, soft green, warm orange)
`.trim();

/** カテゴリごとの重み */
const CATEGORY_WEIGHTS: Record<DishCategory, number> = {
  main: 1.5,
  side: 1.0,
  staple: 0.3, // 毎日食べるので低め
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
 * 影響度リストをフォーマット
 */
function formatInfluenceList(influences: IngredientInfluence[]): string {
  return influences
    .map((i) => `- ${i.name}: ${i.score}${i.isDominant ? " [DOMINANT]" : ""}`)
    .join("\n");
}

/**
 * 食事履歴をフォーマット
 */
function formatMealHistory(meals: MealAnalysis[]): string {
  return meals
    .map((meal) => {
      const dishes = meal.dishes
        .map((d) => `${d.name}(${d.category}, ${d.portion})`)
        .join(", ");
      return `- ${dishes}`;
    })
    .join("\n");
}

/**
 * くま画像生成用プロンプト
 * 過去7日分の食事履歴からくまと部屋を生成
 */
export function buildBearPrompt(meals: MealAnalysis[]): string {
  const mealHistory = formatMealHistory(meals);
  const influences = calculateInfluence(meals);
  const influenceList = formatInfluenceList(influences);
  const dominantItems = influences.filter((i) => i.isDominant);

  return `
Generate a view INSIDE a clay miniature room. We are INSIDE the room looking at the walls. NO exterior visible.

=== Meal History (past 7 days) ===
${mealHistory}

=== Ingredient Influence Scores ===
${influenceList}

=== Concept ===
This magical bear and its entire living space are shaped by what it eats.
Create a complete scene: the bear AND its room should reflect the meal history.
The whole image should look like a tiny clay/polymer clay miniature world.

=== How to express meal influence (ABSTRACT, not literal) ===

Express through CONCEPTS, not food shapes:
- COLOR: Warm meals → warm tones (orange, red). Fresh meals → cool tones (green, blue)
- CULTURE: Japanese food → tatami, shoji. Italian → terracotta, arches. American → cozy cabin
- LIFESTYLE: Healthy food → sporty, active vibe. Comfort food → cozy, relaxed vibe
- PATTERNS: Abstract only (waves, stripes, dots, gradients) - NOT food shapes

=== What to include ===
1. THE BEAR (doing an activity):
   - Fur in soft natural tones with meal-inspired hues
   - Outfit reflecting cultural lifestyle (kimono, sweater, sporty wear, etc.)
   - MUST be doing an activity that matches the meal's culture/lifestyle:
     * Hobby: reading, crafting, painting, playing music, gardening
     * Housework: cleaning, organizing, sewing, arranging flowers
     * Exercise: yoga, stretching, dancing
     * Daily life: relaxing on sofa, looking out window, playing with pet

2. THE ROOM (square room, 3 walls visible):
   - Back wall + left wall + right wall with wallpaper/decorations
   - Ceiling with lighting fixture (lamp, pendant light, etc.)
   - Floor with flooring/rug matching the theme
   - Architecture style matching the food's cultural origin
   - Furniture style (tatami, fireplace, modern, rustic)
   - Color palette inspired by meals

3. THE ATMOSPHERE:
   - Cozy, lived-in feeling
   - Warm lighting, clay/handmade texture

=== DOMINANT ingredients (literal motifs allowed) ===
${dominantItems.length > 0 ?
    dominantItems.map((i) => `- ${i.name} (score: ${i.score}) → can appear as literal motif`).join("\n") :
    "None - use only abstract expressions"}

=== Examples (normal case - abstract influence) ===
- Japanese meals → tatami floor, shoji walls, paper lantern, bear in kimono doing calligraphy
- Italian meals → terracotta walls, arched details, pendant lamp, bear watering plants
- Fresh/healthy meals → white walls, large window, modern light, bear doing yoga
- Comfort/hearty meals → wooden walls, fireplace, warm lamp, bear in sweater reading
- Seafood meals → blue-white walls, porthole window, nautical lamp, bear painting

${RULES}

${STYLE}
`.trim();
}
