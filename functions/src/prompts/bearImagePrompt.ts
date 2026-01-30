import {MealAnalysis, DishCategory, Portion} from "../models";

/**
 * スタイル定義 - 粘土ミニチュア風の部屋
 */
const STYLE = `
Style: Snow globe with clay miniature inside
- Glass dome on decorative base, viewed from outside
- Corner angle showing TWO walls (L-shape), isometric perspective
- Clay/polymer texture, pastel colors, soft dreamy lighting
- NO TEXT, NO WATERMARK anywhere
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

/** 部屋の充実度段階の定義 */
type RoomStage = 1 | 2 | 3 | 4 | 5;

interface RoomStageInfo {
  stage: RoomStage;
  name: string;
  furniture: string;
}

const ROOM_STAGES: Record<RoomStage, Omit<RoomStageInfo, "stage">> = {
  1: {
    name: "はじまりの部屋",
    furniture: `
- Nearly empty room - just starting out
- Single bare light bulb hanging from ceiling
- Plain walls with no decoration
- Simple wooden floor
- Only TWO small items (style based on meals eaten)`.trim(),
  },
  2: {
    name: "少し落ち着いた",
    furniture: `
- Small table and one chair
- Simple lamp replacing bare bulb
- One or two small decorations
- Maybe one small plant
- Basic rug on floor`.trim(),
  },
  3: {
    name: "生活感が出てきた",
    furniture: `
- Sofa or comfortable seating
- Shelves with some items
- Curtains on windows
- Several plants
- Proper ceiling light
- Rug and some textiles`.trim(),
  },
  4: {
    name: "充実してきた",
    furniture: `
- Full furniture set
- Art on the walls
- Nice rug and textiles
- Decorative lighting
- Personal items and hobbies visible`.trim(),
  },
  5: {
    name: "こだわりの空間",
    furniture: `
- Fully furnished, cozy space
- Collections and hobby items displayed
- Quality furniture and decor
- Personal touches everywhere
- Warm, lived-in atmosphere`.trim(),
  },
};

/** クマの基本設定（固定） */
const BEAR_BASE = `
Young bear, cute and fluffy, doing an activity in its room.
Outfit style influenced by meals eaten.
`.trim();

/**
 * 食事回数から部屋の充実度を計算
 */
function calculateRoomStage(mealCount: number): RoomStageInfo {
  let stage: RoomStage;
  if (mealCount <= 6) {
    stage = 1;
  } else if (mealCount <= 15) {
    stage = 2;
  } else if (mealCount <= 27) {
    stage = 3;
  } else if (mealCount <= 39) {
    stage = 4;
  } else {
    stage = 5;
  }
  return {stage, ...ROOM_STAGES[stage]};
}

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
 * くま画像生成用プロンプト
 * 食事履歴と食事回数からくまと部屋を生成
 * @param meals 過去7日分の食事履歴
 * @param totalMealCount 総食事回数（成長段階の計算に使用）
 */
export function buildBearPrompt(meals: MealAnalysis[], totalMealCount: number): string {
  const roomStage = calculateRoomStage(totalMealCount);
  const influences = calculateInfluence(meals);

  // 食事の影響を簡潔に（上位5つ）
  const mealInfluence = meals.length > 0 ?
    influences.slice(0, 5).map((i) => `${i.name}${i.isDominant ? "[DOMINANT]" : ""}`).join(", ") :
    "none";

  return `
⚠️ CRITICAL: NO FOOD, NO TEXT in image. No dishes, plates, letters, or words. Express meals through style only.

Snow globe with bear's miniature room inside.
${BEAR_BASE}

Room level: ${roomStage.stage}/5 (${totalMealCount} meals)
${roomStage.furniture}

${meals.length > 0 ? `
Meal influence: ${mealInfluence}
→ These affect STYLE of clothes, furniture, wallpaper (culture, colors, patterns)
→ DOMINANT items can appear as motifs (e.g. tomato pattern on cushion)
` : "No meals yet → neutral style, simple plain items"}

${STYLE}

⚠️ REMINDER: NO FOOD, NO TEXT - the bear is doing an activity, NOT eating.
`.trim();
}
