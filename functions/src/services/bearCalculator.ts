import {BearParameters, Meal, INITIAL_BEAR_PARAMETERS} from "../models";

/**
 * 過去の食事から BearParameters を計算する
 * - colors: 累積して割合を再計算（上位5色）
 * - nutrition: 累積して割合を再計算（上位5つ）
 * - characteristics: そのまま蓄積（重複OK、頻度が多いほど強調）
 */
export function calculateBearParameters(
  recentMeals: Meal[]
): BearParameters {
  if (recentMeals.length === 0) {
    return INITIAL_BEAR_PARAMETERS;
  }

  return {
    colors: accumulateAndNormalize(
      recentMeals.map((m) => m.analyzedData.colors),
      5
    ),
    nutrition: accumulateAndNormalize(
      recentMeals.map((m) => m.analyzedData.nutrition),
      5
    ),
    characteristics: accumulateCharacteristics(
      recentMeals.map((m) => m.analyzedData.characteristics)
    ),
  };
}

/**
 * Record<string, number>[] を累積して割合を再計算
 * @param records 各食事のデータ（合計100%）
 * @param topN 上位N件を返す
 */
function accumulateAndNormalize(
  records: Record<string, number>[],
  topN: number
): Record<string, number> {
  // 全部足す
  const accumulated: Record<string, number> = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      accumulated[key] = (accumulated[key] || 0) + value;
    }
  }

  // 合計を計算
  const total = Object.values(accumulated).reduce((sum, v) => sum + v, 0);
  if (total === 0) {
    return {};
  }

  // 割合に変換して上位N件を取得
  const sorted = Object.entries(accumulated)
    .map(([key, value]) => [key, Math.round((value / total) * 100)] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  return Object.fromEntries(sorted);
}

/**
 * 特徴を蓄積（重複OK、頻度が多いほどAIに強調される）
 * 例: ["和風", "和風", "こってり"] → 和風が多いことがAIに伝わる
 */
function accumulateCharacteristics(
  characteristicsArrays: string[][]
): string[] {
  const all: string[] = [];
  for (const chars of characteristicsArrays) {
    all.push(...chars);
  }
  return all;
}
