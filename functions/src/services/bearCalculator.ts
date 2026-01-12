import {BearParameters, MealAnalysis, INITIAL_BEAR_PARAMETERS} from "../models";

const DECAY_RATE = 0.8; // 既存値の重み
const NEW_RATE = 0.2; // 新しい値の重み

/**
 * 累積パラメータを更新する
 * 新しい値 = 既存値 × 0.8 + 今回の値 × 0.2
 */
export function updateBearParameters(
  current: BearParameters | null,
  meal: MealAnalysis
): BearParameters {
  const base = current || INITIAL_BEAR_PARAMETERS;

  return {
    colors: mergeColors(base.colors, meal.colors),
    bodyType: calculateBodyType(base.bodyType, meal),
    muscle: calculateMuscle(base.muscle, meal),
    energy: calculateEnergy(base.energy, meal),
    personality: updatePersonality(base.personality, meal),
    accessories: updateAccessories(base.accessories, meal),
  };
}

/**
 * 色を累積マージする
 */
function mergeColors(
  current: Record<string, number>,
  newColors: Record<string, number>
): Record<string, number> {
  const result = {...current};

  // 既存の色を減衰
  for (const hex of Object.keys(result)) {
    result[hex] = result[hex] * DECAY_RATE;
  }

  // 新しい色を追加
  for (const [hex, value] of Object.entries(newColors)) {
    result[hex] = (result[hex] || 0) + value * NEW_RATE;
  }

  // 上位5色のみ保持
  const sorted = Object.entries(result)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return Object.fromEntries(sorted);
}

/**
 * 体型を計算（栄養バランスが悪いとぽっちゃり傾向）
 */
function calculateBodyType(current: number, meal: MealAnalysis): number {
  // バランスが低いほど体型値が上がる（ぽっちゃり方向）
  const mealEffect = 100 - meal.nutrition.balance;
  const newValue = current * DECAY_RATE + mealEffect * NEW_RATE;
  return Math.min(100, Math.max(0, newValue));
}

/**
 * 筋肉を計算（タンパク質が多いと筋肉増加）
 */
function calculateMuscle(current: number, meal: MealAnalysis): number {
  const mealEffect = meal.nutrition.protein;
  const newValue = current * DECAY_RATE + mealEffect * NEW_RATE;
  return Math.min(100, Math.max(0, newValue));
}

/**
 * 元気度を計算（野菜と量で決まる）
 */
function calculateEnergy(current: number, meal: MealAnalysis): number {
  const volumeBonus = meal.volume === "large" ? 20 : meal.volume === "medium" ? 10 : 0;
  const mealEffect = meal.nutrition.vegetable + volumeBonus;
  const newValue = current * DECAY_RATE + mealEffect * NEW_RATE;
  return Math.min(100, Math.max(0, newValue));
}

/**
 * 性格特徴を更新（メニュー名から推定）
 */
function updatePersonality(current: string[], meal: MealAnalysis): string[] {
  const newTraits: string[] = [];

  // メニュー名から性格を推定
  if (meal.menuName.match(/和|定食|魚|味噌/)) {
    newTraits.push("和風");
  }
  if (meal.menuName.match(/パスタ|ピザ|グラタン/)) {
    newTraits.push("洋風");
  }
  if (meal.menuName.match(/サラダ|野菜|ヘルシー/)) {
    newTraits.push("健康的");
  }
  if (meal.menuName.match(/ラーメン|カレー|丼/)) {
    newTraits.push("パワフル");
  }

  // 既存 + 新規、重複排除、最新5件
  const combined = [...new Set([...newTraits, ...current])];
  return combined.slice(0, 5);
}

/**
 * アクセサリを更新（食材から推定）
 */
function updateAccessories(current: string[], meal: MealAnalysis): string[] {
  const newAccessories: string[] = [];

  // 食材からアクセサリを推定
  for (const ingredient of meal.ingredients) {
    if (ingredient.match(/鮭|サーモン/)) {
      newAccessories.push("鮭模様");
    }
    if (ingredient.match(/トマト|にんじん/)) {
      newAccessories.push("赤いほっぺ");
    }
    if (ingredient.match(/レタス|ほうれん草|野菜/)) {
      newAccessories.push("緑の葉っぱ");
    }
    if (ingredient.match(/卵|たまご/)) {
      newAccessories.push("たまご帽子");
    }
  }

  // 既存 + 新規、重複排除、最新5件
  const combined = [...new Set([...newAccessories, ...current])];
  return combined.slice(0, 5);
}
