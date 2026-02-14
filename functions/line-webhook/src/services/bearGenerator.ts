import {GoogleGenAI} from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as logger from "firebase-functions/logger";
import {MealAnalysis} from "../models";
import {
  buildBearImagePromptFromChanges,
  buildFurnitureChangePrompt,
  buildWallFloorChangePrompt,
  buildBearFeaturesPromptFromMeal,
} from "../prompts";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const LOCATION = "us-central1";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

/** クマ特徴生成のtemperature（0.0-2.0、高いほど創造的） */
const BEAR_FEATURES_TEMPERATURE = 1.2;

/** 空の部屋画像パス */
const EMPTY_ROOM_IMAGE_PATH = path.join(__dirname, "../assets/empty-room-3.png");

/**
 * 空の部屋の参照画像を読み込む
 */
function loadEmptyRoomImage(): string {
  const imageBuffer = fs.readFileSync(EMPTY_ROOM_IMAGE_PATH);
  return imageBuffer.toString("base64");
}

/**
 * 過去7日分の食事履歴から差分でくま画像を生成（参照画像あり）
 * @param meals 過去7日分の食事履歴（今回の食事を含む）
 * @param referenceImageBase64 参照画像（Base64）- 初期は空の部屋、以降は前のクマ画像
 */
async function generateImageFromMeals(
  meals: MealAnalysis[],
  referenceImageBase64: string
): Promise<Buffer> {
  // Generate detailed prompt parts via text AI
  async function generateDetailFromAI(instruction: string, temperature?: number): Promise<string> {
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        {
          role: "user",
          parts: [{text: instruction}],
        },
      ],
      config: temperature ? {temperature} : undefined,
    });

    const txt = resp.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return txt.trim();
  }

  // 今日の食事（配列の最後）
  const todaysMeal = meals[meals.length - 1];

  // Generate change prompts
  // 家具と壁/床は過去7日分の累積を見る
  const furnitureInstruction = buildFurnitureChangePrompt(meals);
  const wallFloorInstruction = buildWallFloorChangePrompt(meals);
  // クマは今日の食事だけで決める
  const bearFeaturesInstruction = buildBearFeaturesPromptFromMeal(todaysMeal);

  const [furnitureChangePart, wallFloorChangePart, bearFeaturesPart] = await Promise.all([
    generateDetailFromAI(furnitureInstruction),
    generateDetailFromAI(wallFloorInstruction),
    generateDetailFromAI(bearFeaturesInstruction, BEAR_FEATURES_TEMPERATURE),
  ]);

  const bearPrompts = {
    furnitureChange: furnitureChangePart,
    wallFloorChange: wallFloorChangePart,
    bearFeatures: bearFeaturesPart,
  };

  logger.info("Generated bear prompt parts", {bearPrompts});

  const prompt = buildBearImagePromptFromChanges(bearFeaturesPart, furnitureChangePart, wallFloorChangePart);

  console.log("=== くま生成プロンプト (1/3: Bear Features) ===");
  console.log(bearFeaturesPart);
  console.log("\n=== くま生成プロンプト (2/3: Furniture Change) ===");
  console.log(furnitureChangePart);
  console.log("\n=== くま生成プロンプト (3/3: Wall/Floor Change) ===");
  console.log(wallFloorChangePart);
  console.log("\n=== 完全なプロンプト ===");
  console.log(prompt);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [
          {text: `Edit the interior of this miniature room box. Keep the frame and base as-is.\n\n${prompt}`},
          {
            inlineData: {
              mimeType: "image/png",
              data: referenceImageBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  return extractImageFromResponse(response);
}

/**
 * 過去7日分の食事履歴からくま画像を生成する（差分方式）
 * @param meals 過去7日分の食事履歴（今回の食事を含む）
 * @param previousBearImageBase64 前のクマ画像（Base64）- 初回はundefined
 */
export async function generateBearImage(
  meals: MealAnalysis[],
  previousBearImageBase64?: string
): Promise<Buffer> {
  // 参照画像を決定: 前のクマ画像があればそれを使う、なければ空の部屋画像
  const referenceImage = previousBearImageBase64 || loadEmptyRoomImage();
  logger.info("Using reference image", {
    type: previousBearImageBase64 ? "previousBear" : "emptyRoom",
  });

  // 過去7日分の食事履歴から差分で画像を生成
  return generateImageFromMeals(meals, referenceImage);
}

/**
 * レスポンスから画像データを抽出
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageFromResponse(response: any): Buffer {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts;
  const imagePart = parts?.find((part: {inlineData?: {data?: string}}) => part.inlineData?.data);
  const imageData = imagePart?.inlineData?.data;

  if (!imageData) {
    // デバッグ用: レスポンス内容をログ出力
    logger.error("Image generation failed - response details", {
      finishReason: candidate?.finishReason,
      safetyRatings: candidate?.safetyRatings,
      partsCount: parts?.length,
      partsTypes: parts?.map((p: {text?: string; inlineData?: unknown}) =>
        p.text ? "text" : p.inlineData ? "inlineData" : "unknown"
      ),
      textContent: parts?.find((p: {text?: string}) => p.text)?.text,
    });
    throw new Error("Failed to generate bear image");
  }

  return Buffer.from(imageData, "base64");
}
