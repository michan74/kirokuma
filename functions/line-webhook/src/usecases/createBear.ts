import * as logger from "firebase-functions/logger";
import {MealAnalysis} from "../models";
import {
  analyzeMeal,
  NotFoodError,
  generateBearImage,
  uploadImage,
  downloadImageAsBase64,
  saveBear,
  getLatestBear,
  saveMeal,
  getMealCount,
  getRecentMeals,
  reincarnate,
  getActiveGroup,
  analyzeTrends,
} from "../services";

/**
 * クマ生成の結果
 */
export interface CreateBearResult {
  success: true;
  bearImageUrl: string;
  mealAnalysis: MealAnalysis;
  isFirstTime: boolean;
}

/**
 * クマ生成のエラー
 */
export interface CreateBearError {
  success: false;
  errorType: "not_food" | "unknown";
  message: string;
}

export type CreateBearResponse = CreateBearResult | CreateBearError;

/**
 * クマ画像を生成するユースケース
 * @param imageBase64 食事画像（Base64）
 * @param userId ユーザーID
 */
export async function createBear(
  imageBase64: string,
  userId: string
): Promise<CreateBearResponse> {
  try {
    // 1. 食事を分析
    const mealAnalysis = await analyzeMeal(imageBase64);
    logger.info("Meal analysis result", {mealAnalysis});

    // 2. アクティブなグループを取得（なければ作成）
    let activeGroup = await getActiveGroup(userId);
    if (!activeGroup) {
      activeGroup = await reincarnate(userId);
      logger.info("Created first group for user", {groupId: activeGroup.id});
    }
    const groupId = activeGroup.id;

    // 3. 初回かどうかの判定用 & 過去7日分の食事履歴を取得
    const currentMealCount = await getMealCount(userId, groupId);
    const recentMeals = await getRecentMeals(userId, groupId);
    const pastMealAnalyses = recentMeals.map((meal) => meal.analyzedData);
    logger.info("Current meal count", {currentMealCount, pastMealsCount: pastMealAnalyses.length});

    // 4. 傾向分析（料理クラスタリング + Geminiテキスト分析）
    const dishEmbeddings = recentMeals.map((meal) => meal.dishEmbedding);
    const trendAnalysis = await analyzeTrends(pastMealAnalyses, dishEmbeddings);
    logger.info("Trend analysis", {trendAnalysis});

    // 5. 前のクマ画像を取得（現在のグループから）
    let previousBearImageBase64: string | undefined;
    const latestBear = await getLatestBear(userId, groupId);
    if (latestBear) {
      previousBearImageBase64 = await downloadImageAsBase64(latestBear.imageUrl);
      logger.info("Previous bear image fetched", {bearId: latestBear.id});
    }

    // 6. 過去7日分+今回の食事履歴からくま画像を生成（差分方式）
    const allMeals = [...pastMealAnalyses, mealAnalysis];
    const bearImageBuffer = await generateBearImage(allMeals, previousBearImageBase64, trendAnalysis);
    logger.info("Bear image generated");

    // 7. 食事画像をStorageにアップロード
    const timestamp = Date.now();
    const mealImageBuffer = Buffer.from(imageBase64, "base64");
    const mealImageUrl = await uploadImage(mealImageBuffer, `meals/${userId}/${timestamp}.jpg`);
    logger.info("Meal image uploaded", {url: mealImageUrl});

    // 8. くま画像をStorageにアップロード
    const bearImageUrl = await uploadImage(bearImageBuffer, `bears/${timestamp}.png`);
    logger.info("Bear image uploaded", {url: bearImageUrl});

    // 9. くまをDBに保存
    const savedBear = await saveBear(bearImageUrl, userId);
    logger.info("Bear saved", {bearId: savedBear.id});

    // 10. 食事をDBに保存（画像URLも保存）
    const savedMeal = await saveMeal(mealAnalysis, savedBear.id, groupId, userId, mealImageUrl);
    logger.info("Meal saved", {mealId: savedMeal.id});

    return {
      success: true,
      bearImageUrl,
      mealAnalysis,
      isFirstTime: currentMealCount === 0,
    };
  } catch (error) {
    if (error instanceof NotFoodError) {
      return {
        success: false,
        errorType: "not_food",
        message: "食べ物を認識できませんでした",
      };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    logger.error("Error creating bear", {message: errorMessage, stack: errorStack});

    return {
      success: false,
      errorType: "unknown",
      message: errorMessage,
    };
  }
}
