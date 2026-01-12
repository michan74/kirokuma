import {GoogleGenAI} from "@google/genai";
import {MealAnalysis} from "../models";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const LOCATION = "us-central1";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

const ANALYSIS_PROMPT = `
この食事の写真を分析して、以下のJSON形式で回答してください。
必ずJSONのみを返してください。説明文は不要です。

{
  "menuName": "料理名（例: 鮭の塩焼き定食）",
  "ingredients": ["食材1", "食材2", "食材3"],
  "colors": {
    "#HEXコード": 割合（%）
  },
  "nutrition": {
    "balance": 栄養バランススコア（0-100）,
    "protein": タンパク質スコア（0-100）,
    "vegetable": 野菜スコア（0-100）
  },
  "volume": "small" | "medium" | "large"
}

注意:
- colorsは写真に写っている実際の色味を上位3色まで抽出（HEXコードと割合%）
- nutritionは見た目から推定される栄養スコア
- volumeは食事の量（少なめ/普通/多め）
`;

/**
 * 食事画像を分析してMealAnalysisを返す
 */
export async function analyzeMeal(imageBase64: string): Promise<MealAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64,
            },
          },
          {text: ANALYSIS_PROMPT},
        ],
      },
    ],
  });

  const text = response.text || "";

  // JSONを抽出してパース
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse meal analysis response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as MealAnalysis;
  return parsed;
}
