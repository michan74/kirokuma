import {GoogleGenAI} from "@google/genai";
import * as logger from "firebase-functions/logger";
import {MealAnalysis, TrendAnalysis, TextTrendResult} from "../models";
import {clusterDishes} from "./embeddingService";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const LOCATION = "us-central1";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

/**
 * 過去の食事履歴からタグ・食材の傾向をGeminiで分析
 */
export async function analyzeTextTrends(meals: MealAnalysis[]): Promise<TextTrendResult> {
  if (meals.length === 0) {
    return {moodTrend: "なし", ingredientTrend: "なし"};
  }

  // 全タグと食材を集める
  const allTags = meals.flatMap((m) => m.tags);
  const allIngredients = meals.flatMap((m) => m.ingredients);

  const prompt = `以下は過去${meals.length}回の食事のデータです。傾向を分析してください。

=== タグ一覧 ===
${allTags.join(", ")}

=== 食材一覧 ===
${allIngredients.join(", ")}

=== 分析ルール ===
- 似ているものはまとめて考える（きのこ、しいたけ、えのき → きのこ系）
- 繰り返し登場するものを「傾向」として抽出
- 傾向がない場合は「特になし」

=== 出力形式（JSON） ===
{
  "moodTrend": "雰囲気の傾向を1文で（例：ほっこり和食系）",
  "ingredientTrend": "食材の傾向を1文で（例：きのこ系が多め）"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{role: "user", parts: [{text: prompt}]}],
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      logger.info("analyzeTextTrends: Analysis complete", {
        moodTrend: parsed.moodTrend,
        ingredientTrend: parsed.ingredientTrend,
      });
      return {
        moodTrend: parsed.moodTrend || "特になし",
        ingredientTrend: parsed.ingredientTrend || "特になし",
      };
    }
  } catch (error) {
    logger.error("analyzeTextTrends: Failed", {error});
  }

  return {moodTrend: "特になし", ingredientTrend: "特になし"};
}

/**
 * 総合的な傾向分析を実行
 * @param meals 食事分析結果の配列
 * @param dishEmbeddings 料理名のEmbedding配列（mealsと同じ順序）
 */
export async function analyzeTrends(
  meals: MealAnalysis[],
  dishEmbeddings: (number[] | undefined)[]
): Promise<TrendAnalysis> {
  // 料理名のクラスタリング
  const dishesWithEmbedding = meals
    .map((m, i) => ({
      dish: m.dish,
      embedding: dishEmbeddings[i],
    }))
    .filter((d): d is {dish: string; embedding: number[]} => d.embedding !== undefined);

  const dishesCluster = clusterDishes(dishesWithEmbedding);

  // タグ・食材のテキスト分析
  const textTrends = await analyzeTextTrends(meals);

  return {
    dishes: dishesCluster,
    textTrends,
  };
}