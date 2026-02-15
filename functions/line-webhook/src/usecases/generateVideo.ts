import * as logger from "firebase-functions/logger";
import {
  getActiveGroup,
  getRecentBearsWithMeals,
  buildBearWithMealFlexMessage,
  generateVideoWithPython,
} from "../services";
import {messagingApi} from "@line/bot-sdk";

type FlexMessage = messagingApi.FlexMessage;

/**
 * 動画生成の結果
 */
export interface GenerateVideoResult {
  success: true;
  videoUrl: string;
  thumbnailUrl: string;
}

/**
 * 動画生成のエラー
 */
export interface GenerateVideoError {
  success: false;
  errorType: "no_group" | "not_enough_bears" | "generation_failed";
  message: string;
}

/**
 * 動画生成前のクマ情報
 */
export interface BearsForVideo {
  success: true;
  groupId: string;
  bearImageUrls: string[];
  flexMessage: FlexMessage;
}

export type GenerateVideoResponse = GenerateVideoResult | GenerateVideoError;

/**
 * 動画生成前にクマ画像を取得する
 * FlexMessageを先に返して時間稼ぎする用
 */
export async function getBearsForVideo(
  userId: string
): Promise<BearsForVideo | GenerateVideoError> {
  // アクティブなグループを取得
  const activeGroup = await getActiveGroup(userId);
  if (!activeGroup) {
    return {
      success: false,
      errorType: "no_group",
      message: "まだ食事の記録がないよ🐻\nまずは食事の写真を送ってね！",
    };
  }

  // クマと食事を取得（最大30枚）
  const bearsWithMeals = await getRecentBearsWithMeals(userId, activeGroup.id, 30);
  if (bearsWithMeals.length < 2) {
    return {
      success: false,
      errorType: "not_enough_bears",
      message: "動画を作るには2枚以上のクマ画像が必要だよ🐻\nもう少し食事を記録してね！",
    };
  }

  // 昇順（古い順）に並び替え
  const reversed = [...bearsWithMeals].reverse();
  const bearImageUrls = reversed.map((b) => b.bear.imageUrl);
  const flexMessage = buildBearWithMealFlexMessage(reversed, "これまでのクマたち");

  return {success: true, groupId: activeGroup.id, bearImageUrls, flexMessage};
}

/**
 * 動画を生成するユースケース
 * @param userId ユーザーID
 * @param groupId グループID
 */
export async function generateVideo(
  userId: string,
  groupId: string
): Promise<GenerateVideoResponse> {
  try {
    logger.info("Starting video generation with python-video-generator", {
      userId,
      groupId,
    });

    // python-video-generatorで動画生成
    const result = await generateVideoWithPython(userId, groupId);

    logger.info("Video generated with python-video-generator", {
      videoUrl: result.videoUrl,
      thumbnailUrl: result.thumbnailUrl,
    });

    return {
      success: true,
      videoUrl: result.videoUrl,
      thumbnailUrl: result.thumbnailUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    logger.error("Error generating video", {
      message: errorMessage,
      stack: errorStack,
    });

    return {
      success: false,
      errorType: "generation_failed",
      message: errorMessage,
    };
  }
}
