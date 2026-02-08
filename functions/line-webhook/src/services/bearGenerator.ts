import {GoogleGenAI} from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as logger from "firebase-functions/logger";
import {MealAnalysis} from "../models";
import {
  buildBearImagePromptFromParts,
  calculateRoomStage,
  buildFurnitureGenerationPromptFromMeals,
  buildWallpaperFloorGenerationPromptFromMeals,
  buildBearFeaturesGenerationPromptFromMeals,
} from "../prompts";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const LOCATION = "us-central1";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

/** 空の部屋画像探索パス */
const EMPTY_ROOM_IMAGE_CANDIDATES = [
  path.join(__dirname, "../assets/empty-room-2.png"),
  path.join(__dirname, "../../src/assets/empty-room-2.png"),
  path.join(process.cwd(), "src/assets/empty-room-2.png"),
];

function resolveEmptyRoomImagePath(): string {
  for (const candidate of EMPTY_ROOM_IMAGE_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Empty room reference image not found");
}

/**
 * 空の部屋の参照画像を読み込む
 */
function loadEmptyRoomImage(): string {
  const imagePath = resolveEmptyRoomImagePath();
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString("base64");
}

/**
 * Step2: 食事履歴から直接くま画像を生成（参照画像あり）
 * RoomStyleを経由せずに、食事履歴から直接プロンプトを生成
 * @param meals 食事履歴
 * @param totalMealCount 総食事回数
 * @param referenceImageBase64 参照画像（Base64）- 初期は空の部屋、以降は前のクマ画像
 */
async function generateImageFromMeals(
  meals: MealAnalysis[],
  totalMealCount: number,
  referenceImageBase64: string
): Promise<Buffer> {
  // Calculate room stage
  const roomStage = calculateRoomStage(totalMealCount);

  // Generate detailed prompt parts via text AI
  async function generateDetailFromAI(instruction: string): Promise<string> {
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        {
          role: "user",
          parts: [{text: instruction}],
        },
      ],
    });

    const txt = resp.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return txt.trim();
  }

  // Generate prompt parts directly from meals
  const furnitureInstruction = buildFurnitureGenerationPromptFromMeals(meals, roomStage);
  const wallpaperFloorInstruction = buildWallpaperFloorGenerationPromptFromMeals(meals);
  const bearFeaturesInstruction = buildBearFeaturesGenerationPromptFromMeals(meals);

  const [furniturePart, wallpaperFloorPart, bearFeaturesPart] = await Promise.all([
    generateDetailFromAI(furnitureInstruction),
    generateDetailFromAI(wallpaperFloorInstruction),
    generateDetailFromAI(bearFeaturesInstruction),
  ]);

  const bearPrompts = {
    furniture: furniturePart,
    wallpaperFloor: wallpaperFloorPart,
    bearFeatures: bearFeaturesPart,
  };

  logger.info("Generated bear prompt parts", {bearPrompts});

  const prompt = buildBearImagePromptFromParts(bearFeaturesPart, furniturePart, wallpaperFloorPart, roomStage);

  console.log("=== くま生成プロンプト (1/3: Bear Features) ===");
  console.log(bearFeaturesPart);
  console.log("\n=== くま生成プロンプト (2/3: Furniture) ===");
  console.log(furniturePart);
  console.log("\n=== くま生成プロンプト (3/3: Wallpaper/Floor) ===");
  console.log(wallpaperFloorPart);
  console.log("\n=== 完全なプロンプト ===");
  console.log(prompt);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [
          {text: `Edit this room image based on the following instructions:\n\n${prompt}`},
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
    },
  });

  return extractImageFromResponse(response);
}

/**
 * 過去の食事履歴からくま画像を生成する（直接生成方式）
 * @param meals 過去7日分の食事履歴
 * @param totalMealCount 総食事回数（成長段階の計算に使用）
 * @param previousBearImageBase64 前のクマ画像（Base64）- 初回はundefined
 */
export async function generateBearImage(
  meals: MealAnalysis[],
  totalMealCount: number,
  previousBearImageBase64?: string
): Promise<Buffer> {
  // 参照画像を決定: 前のクマ画像があればそれを使う、なければ空の部屋画像
  const referenceImage = previousBearImageBase64 || loadEmptyRoomImage();
  logger.info("Using reference image", {
    type: previousBearImageBase64 ? "previousBear" : "emptyRoom",
  });

  // 食事履歴から直接画像を生成
  return generateImageFromMeals(meals, totalMealCount, referenceImage);
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
