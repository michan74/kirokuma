import {GoogleGenAI} from "@google/genai";
import {BearParameters, MealAnalysis} from "../models";
import {buildBearPrompt} from "../prompts";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const LOCATION = "us-central1";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

/**
 * くまパラメータと今回の食事から画像を生成する（Gemini 2.5 Flash Image）
 */
export async function generateBearImage(
  params: BearParameters,
  currentMeal: MealAnalysis
): Promise<Buffer> {
  const prompt = buildBearPrompt(params, currentMeal);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [{text: `Generate an image: ${prompt}`}],
      },
    ],
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  // レスポンスから画像データを取得
  const parts = response.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find((part: {inlineData?: {data?: string}}) => part.inlineData?.data);
  const imageData = imagePart?.inlineData?.data;

  if (!imageData) {
    throw new Error("Failed to generate bear image");
  }

  return Buffer.from(imageData, "base64");
}

/**
 * プロンプトを取得（デバッグ用）
 */
export function getBearPrompt(
  params: BearParameters,
  currentMeal: MealAnalysis
): string {
  return buildBearPrompt(params, currentMeal);
}
