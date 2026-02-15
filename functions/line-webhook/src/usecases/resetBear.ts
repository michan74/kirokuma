import * as logger from "firebase-functions/logger";
import {reincarnate} from "../services";
import {BearGroup} from "../models";

/**
 * リセット（転生）の結果
 */
export interface ResetBearResult {
  success: true;
  newGroup: BearGroup;
}

/**
 * リセット（転生）のエラー
 */
export interface ResetBearError {
  success: false;
  message: string;
}

export type ResetBearResponse = ResetBearResult | ResetBearError;

/**
 * クマをリセット（転生）するユースケース
 * 現在のグループを終了し、新しいグループを作成する
 * @param userId ユーザーID
 */
export async function resetBear(userId: string): Promise<ResetBearResponse> {
  try {
    const newGroup = await reincarnate(userId);
    logger.info("Reincarnation complete", {userId, newGroupId: newGroup.id});

    return {
      success: true,
      newGroup,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    logger.error("Error resetting bear", {
      message: errorMessage,
      stack: errorStack,
    });

    return {
      success: false,
      message: errorMessage,
    };
  }
}
