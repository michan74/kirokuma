import {GoogleGenAI} from "@google/genai";
import {MealAnalysis} from "../models";
import {buildBearPrompt} from "../prompts";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const LOCATION = "us-central1";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

/**
 * 過去の食事履歴からくま画像を生成する
 * @param meals 過去7日分の食事履歴
 * @param totalMealCount 総食事回数（成長段階の計算に使用）
 */
export async function generateBearImage(
  meals: MealAnalysis[],
  totalMealCount: number
): Promise<Buffer> {
  const prompt = buildBearPrompt(meals, totalMealCount);

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

  return extractImageFromResponse(response);
}

/**
 * レスポンスから画像データを抽出
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageFromResponse(response: any): Buffer {
  const parts = response.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find((part: {inlineData?: {data?: string}}) => part.inlineData?.data);
  const imageData = imagePart?.inlineData?.data;

  if (!imageData) {
    throw new Error("Failed to generate bear image");
  }

  return Buffer.from(imageData, "base64");
}
