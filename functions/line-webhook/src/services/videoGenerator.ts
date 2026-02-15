import * as logger from "firebase-functions/logger";

const VIDEO_GENERATOR_URL = process.env.VIDEO_GENERATOR_URL ||
  "https://us-central1-kirokuma.cloudfunctions.net/generate_video_python";

interface VideoGeneratorResponse {
  videoUrl: string;
  thumbnailUrl: string;
  imageCount: number;
  duration: number;
}

/**
 * python-video-generatorを呼び出して動画を生成する
 * @param userId ユーザーID
 * @param groupId グループID
 * @param imageCount 使用する画像数（デフォルト7）
 * @returns 生成された動画のURL
 */
export async function generateVideoWithPython(
  userId: string,
  groupId: string,
  imageCount = 7
): Promise<{videoUrl: string; thumbnailUrl: string}> {
  logger.info("Calling python-video-generator", {
    userId,
    groupId,
    imageCount,
    url: VIDEO_GENERATOR_URL,
  });

  const response = await fetch(VIDEO_GENERATOR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      groupId,
      imageCount,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("python-video-generator error", {
      status: response.status,
      error: errorText,
    });
    throw new Error(`Video generation failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as VideoGeneratorResponse;
  logger.info("Video generated successfully", {
    videoUrl: result.videoUrl,
    thumbnailUrl: result.thumbnailUrl,
    imageCount: result.imageCount,
    duration: result.duration,
  });

  return {
    videoUrl: result.videoUrl,
    thumbnailUrl: result.thumbnailUrl,
  };
}
