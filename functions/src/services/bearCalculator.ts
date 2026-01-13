import {BearParameters, MealAnalysis, Meal, INITIAL_BEAR_PARAMETERS} from "../models";

const DECAY_RATE = 0.8; // 既存値の重み
const NEW_RATE = 0.2; // 新しい値の重み

/**
 * 累積パラメータを更新する
 * 新しい値 = 既存値 × 0.8 + 今回の値 × 0.2
 * 過去の食事履歴も考慮する
 */
export function updateBearParameters(
  current: BearParameters | null,
  meal: MealAnalysis,
  recentMeals: Meal[] = []
): BearParameters {
  const base = current || INITIAL_BEAR_PARAMETERS;

  // 直近の食事から栄養傾向を計算
  const trend = calculateNutritionTrend(recentMeals);

  return {
    colors: mergeColors(base.colors, meal.colors),
    bodyType: calculateBodyType(base.bodyType, meal, trend),
    muscle: calculateMuscle(base.muscle, meal, trend),
    energy: calculateEnergy(base.energy, meal, trend),
    personality: updatePersonality(base.personality, meal, recentMeals),
    accessories: updateAccessories(base.accessories, meal),
  };
}

/**
 * 直近の食事から栄養傾向を計算
 */
interface NutritionTrend {
  avgBalance: number;
  avgProtein: number;
  avgVegetable: number;
  mealCount: number;
}

function calculateNutritionTrend(recentMeals: Meal[]): NutritionTrend {
  if (recentMeals.length === 0) {
    return {avgBalance: 50, avgProtein: 50, avgVegetable: 50, mealCount: 0};
  }

  const totals = recentMeals.reduce(
    (acc, meal) => ({
      balance: acc.balance + meal.analyzedData.nutrition.balance,
      protein: acc.protein + meal.analyzedData.nutrition.protein,
      vegetable: acc.vegetable + meal.analyzedData.nutrition.vegetable,
    }),
    {balance: 0, protein: 0, vegetable: 0}
  );

  const count = recentMeals.length;
  return {
    avgBalance: totals.balance / count,
    avgProtein: totals.protein / count,
    avgVegetable: totals.vegetable / count,
    mealCount: count,
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
function calculateBodyType(
  current: number,
  meal: MealAnalysis,
  trend: NutritionTrend
): number {
  // バランスが低いほど体型値が上がる（ぽっちゃり方向）
  const mealEffect = 100 - meal.nutrition.balance;
  // 履歴がある場合は傾向も加味
  const trendEffect = trend.mealCount > 0 ? (100 - trend.avgBalance) * 0.1 : 0;
  const newValue = current * DECAY_RATE + mealEffect * NEW_RATE + trendEffect;
  return Math.min(100, Math.max(0, newValue));
}

/**
 * 筋肉を計算（タンパク質が多いと筋肉増加）
 */
function calculateMuscle(
  current: number,
  meal: MealAnalysis,
  trend: NutritionTrend
): number {
  const mealEffect = meal.nutrition.protein;
  // 継続的にタンパク質を摂取していると筋肉がつきやすい
  const trendBonus = trend.mealCount > 0 && trend.avgProtein > 60 ? 5 : 0;
  const newValue = current * DECAY_RATE + mealEffect * NEW_RATE + trendBonus;
  return Math.min(100, Math.max(0, newValue));
}

/**
 * 元気度を計算（野菜と量で決まる）
 */
function calculateEnergy(
  current: number,
  meal: MealAnalysis,
  trend: NutritionTrend
): number {
  const volumeBonus = meal.volume === "large" ? 20 : meal.volume === "medium" ? 10 : 0;
  const mealEffect = meal.nutrition.vegetable + volumeBonus;
  // 野菜を継続的に摂取していると元気度が上がりやすい
  const trendBonus = trend.mealCount > 0 && trend.avgVegetable > 60 ? 5 : 0;
  const newValue = current * DECAY_RATE + mealEffect * NEW_RATE + trendBonus;
  return Math.min(100, Math.max(0, newValue));
}

/**
 * 性格特徴を更新（メニュー名から推定、履歴も考慮）
 */
function updatePersonality(
  current: string[],
  meal: MealAnalysis,
  recentMeals: Meal[]
): string[] {
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
