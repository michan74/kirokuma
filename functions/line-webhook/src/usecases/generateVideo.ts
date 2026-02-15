import * as logger from "firebase-functions/logger";
import {
  getRecentBears,
  getActiveGroup,
  buildBearFlexMessage,
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

  // クマ画像を取得
  const bears = await getRecentBears(userId, activeGroup.id, 10);
  if (bears.length < 2) {
    return {
      success: false,
      errorType: "not_enough_bears",
      message: "動画を作るには2枚以上のクマ画像が必要だよ🐻\nもう少し食事を記録してね！",
    };
  }

  const bearImageUrls = bears.map((b) => b.imageUrl);
  const flexMessage = buildBearFlexMessage(bearImageUrls, "これまでのクマたち");

  return {success: true, bearImageUrls, flexMessage};
}

/**
 * 動画を生成するユースケース
 * @param userId ユーザーID
 * @param groupId グループID（オプション）
 */
export async function generateVideo(
  userId: string,
  groupId?: string
): Promise<GenerateVideoResponse> {
  try {
    // アクティブなグループを取得
    let targetGroupId = groupId;
    if (!targetGroupId) {
      const activeGroup = await getActiveGroup(userId);
      if (!activeGroup) {
        return {
          success: false,
          errorType: "no_group",
          message: "まだ食事の記録がないよ🐻\nまずは食事の写真を送ってね！",
        };
      }
      targetGroupId = activeGroup.id;
    }

    // クマ画像を取得
    const bears = await getRecentBears(userId, targetGroupId, 10);
    if (bears.length < 2) {
      return {
        success: false,
        errorType: "not_enough_bears",
        message: "動画を作るには2枚以上のクマ画像が必要だよ🐻\nもう少し食事を記録してね！",
      };
    }

    logger.info("Bears fetched for video", {count: bears.length});

    // Python動画生成関数を呼び出し
    const videoGeneratorUrl =
      process.env.VIDEO_GENERATOR_URL ||
      "https://generate-video-python-j7lkvu6b3a-uc.a.run.app";

    logger.info("Calling video generator", {
      url: videoGeneratorUrl,
      userId,
      groupId: targetGroupId,
    });

    const response = await fetch(videoGeneratorUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({userId, groupId: targetGroupId, imageCount: 10}),
    });

    logger.info("Video generator response", {
      status: response.status,
      ok: response.ok,
    });

    const resultText = await response.text();
    logger.info("Video generator response body", {
      body: resultText.substring(0, 500),
    });

    let result: {videoUrl?: string; thumbnailUrl?: string; error?: string};
    try {
      result = JSON.parse(resultText);
    } catch {
      throw new Error(`Invalid JSON response: ${resultText.substring(0, 200)}`);
    }

    if (!response.ok || !result.videoUrl || !result.thumbnailUrl) {
      throw new Error(
        result.error || `Video generation failed (status: ${response.status})`
      );
    }

    logger.info("Video generated", {
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