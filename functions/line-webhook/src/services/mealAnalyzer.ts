import {GoogleGenAI} from "@google/genai";
import {MealAnalysis} from "../models";
import {MEAL_ANALYSIS_PROMPT} from "../prompts";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const LOCATION = "us-central1";

/**
 * 食べ物以外の画像が送られた場合のエラー
 */
export class NotFoodError extends Error {
  constructor() {
    super("Not a food image");
    this.name = "NotFoodError";
  }
}

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

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
          {text: MEAL_ANALYSIS_PROMPT},
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

  const parsed = JSON.parse(jsonMatch[0]);

  // 食べ物でない場合はエラーをthrow
  if (parsed.isFood === false) {
    throw new NotFoodError();
  }

  return parsed as MealAnalysis;
}
