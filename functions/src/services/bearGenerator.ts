import {GoogleGenAI} from "@google/genai";
import {BearParameters} from "../models";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const LOCATION = "us-central1";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

/**
 * くまパラメータから画像生成用のプロンプトを作成
 */
function buildPrompt(params: BearParameters): string {
  // 上位の色を取得
  const topColors = Object.entries(params.colors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hex]) => hex);

  const colorDesc = topColors.length > 0 ?
    `with fur colors inspired by ${topColors.join(", ")}` :
    "with white fur";

  // 体型の説明
  let bodyDesc = "normal-sized";
  if (params.bodyType > 70) {
    bodyDesc = "chubby and round";
  } else if (params.bodyType < 30) {
    bodyDesc = "slim and lean";
  }

  // 筋肉の説明
  let muscleDesc = "";
  if (params.muscle > 70) {
    muscleDesc = ", muscular";
  }

  // 元気度の説明
  let energyDesc = "happy";
  if (params.energy > 70) {
    energyDesc = "very energetic and excited";
  } else if (params.energy < 30) {
    energyDesc = "sleepy and relaxed";
  }

  // 性格特徴
  const personalityDesc = params.personality.length > 0 ?
    `with a ${params.personality.join(", ")} personality` :
    "";

  // アクセサリ
  const accessoryDesc = params.accessories.length > 0 ?
    `wearing ${params.accessories.join(", ")}` :
    "";

  return `
A cute cartoon bear character, kawaii style, simple and adorable design.
${bodyDesc}${muscleDesc} bear ${colorDesc}.
The bear looks ${energyDesc} ${personalityDesc}.
${accessoryDesc}
Flat illustration style, pastel colors, white background.
No text, no watermark.
`.trim();
}

/**
 * くまパラメータから画像を生成する（Gemini 2.5 Flash Image / nanobanana）
 */
export async function generateBearImage(params: BearParameters): Promise<Buffer> {
  const prompt = buildPrompt(params);

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
export function getBearPrompt(params: BearParameters): string {
  return buildPrompt(params);
}
