import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import {GoogleAuth} from "google-auth-library";
import ffmpeg from "fluent-ffmpeg";

const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT || "";
const LOCATION = "us-central1";
const MODEL_ID = "veo-3.1-generate-preview";

const VERTEX_AI_ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1`;

/**
 * Veo 3.1 を使用してクマの歴史ムービーを生成する
 * 最大3枚のクマ画像をReference-to-video (Subject)として渡す
 * @param bearImageUrls - クマ画像URLリスト（時系列順、最大3枚）
 * @param userId - ユーザーID
 * @returns 生成された動画のURL
 */
export async function generateVideoWithVeo(
  bearImageUrls: string[],
  userId: string
): Promise<{videoUrl: string; thumbnailUrl: string}> {
  // 最大3枚に制限（Reference-to-videoの制限）
  const urls = bearImageUrls.slice(0, 3);

  if (urls.length < 1) {
    throw new Error("At least 1 bear image is required");
  }

  logger.info("Starting Veo 3.1 Reference-to-video generation", {
    imageCount: urls.length,
    userId,
  });

  const tempDir = path.join(os.tmpdir(), `veo-${Date.now()}`);
  await fs.mkdir(tempDir, {recursive: true});

  try {
    // 1. 画像をダウンロードしてBase64エンコード
    const base64Images = await Promise.all(urls.map(downloadAndBase64Encode));
    logger.info("All images converted to Base64", {count: base64Images.length});

    // 2. Veo 3.1で動画生成
    const bucket = admin.storage().bucket();
    const outputPath = `videos/${userId}/veo_output/${Date.now()}/`;
    const outputGcsUri = `gs://${bucket.name}/${outputPath}`;

    const videoGcsUri = await generateVideoWithReferences(
      base64Images,
      outputGcsUri
    );
    logger.info("Video generated", {videoGcsUri});

    // 3. 動画をダウンロード
    const localVideoPath = path.join(tempDir, "output.mp4");
    await downloadFromGcs(videoGcsUri, localVideoPath);
    logger.info("Video downloaded");

    // 4. サムネイル生成
    const thumbnailPath = path.join(tempDir, "thumbnail.jpg");
    await generateThumbnail(localVideoPath, thumbnailPath);

    // 5. 動画とサムネイルをアップロード
    const timestamp = Date.now();
    const videoUrl = await uploadToStorage(
      localVideoPath,
      `videos/${userId}/${timestamp}.mp4`,
      "video/mp4"
    );
    const thumbnailUrl = await uploadToStorage(
      thumbnailPath,
      `videos/${userId}/${timestamp}_thumb.jpg`,
      "image/jpeg"
    );
    logger.info("Final video uploaded", {videoUrl, thumbnailUrl});

    return {videoUrl, thumbnailUrl};
  } finally {
    // クリーンアップ
    await fs.rm(tempDir, {recursive: true, force: true}).catch(() => {
      // クリーンアップ失敗は無視
    });
  }
}

/**
 * Firebase Storage URLから画像をダウンロードしてBase64エンコード
 */
async function downloadAndBase64Encode(firebaseUrl: string): Promise<string> {
  const urlObj = new URL(firebaseUrl);
  const bucket = admin.storage().bucket();
  let storagePath: string;

  if (urlObj.hostname === "firebasestorage.googleapis.com") {
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
    if (!pathMatch) {
      throw new Error(`Invalid Firebase Storage URL: ${firebaseUrl}`);
    }
    storagePath = decodeURIComponent(pathMatch[1]);
  } else if (urlObj.hostname === "storage.googleapis.com") {
    const pathParts = urlObj.pathname.split("/").filter((p) => p);
    storagePath = pathParts.slice(1).join("/");
  } else {
    throw new Error(`Unsupported URL format: ${firebaseUrl}`);
  }

  const file = bucket.file(storagePath);
  const [buffer] = await file.download();
  return buffer.toString("base64");
}

/**
 * Veo 3.1 Reference-to-video (Subject)で動画生成
 */
async function generateVideoWithReferences(
  base64Images: string[],
  outputGcsUri: string
): Promise<string> {
  logger.info("Generating video with references", {imageCount: base64Images.length});

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const url = `${VERTEX_AI_ENDPOINT}/projects/${PROJECT_ID}` +
    `/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predictLongRunning`;

  const prompt = "A cute bear character living its daily life in a cozy room. " +
    "The bear is eating, relaxing, and enjoying time. " +
    "Warm and gentle animation style with soft lighting.";

  // referenceImagesを構築
  const referenceImages = base64Images.map((base64) => ({
    image: {
      bytesBase64Encoded: base64,
      mimeType: "image/png",
    },
    referenceType: "asset",
  }));

  const requestBody = {
    instances: [
      {
        prompt,
        referenceImages,
      },
    ],
    parameters: {
      storageUri: outputGcsUri,
      sampleCount: 1,
      aspectRatio: "9:16",
      durationSeconds: 8,
    },
  };

  logger.info("Sending request to Veo 3.1", {url, prompt});

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Veo 3.1 API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as {name: string};
  const operationName = result.name;
  logger.info("predictLongRunning response", {operationName});

  // ポーリングして完了を待機
  return await pollOperationUntilDone(operationName);
}

/**
 * オペレーションの完了をポーリング
 */
async function pollOperationUntilDone(
  operationName: string,
  maxAttempts = 120,
  intervalMs = 5000
): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();

  const pollUrl = `${VERTEX_AI_ENDPOINT}/${operationName}`;
  logger.info("Polling URL", {pollUrl});

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const accessToken = await client.getAccessToken();

    const response = await fetch(pollUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken.token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Polling error: ${response.status} - ${errorText}`);
    }

    interface OperationResponse {
      done?: boolean;
      error?: {message: string};
      response?: {
        videos?: Array<{gcsUri: string; mimeType: string}>;
        raiMediaFilteredCount?: number;
      };
    }

    const result = await response.json() as OperationResponse;

    if (attempt % 6 === 0) { // 30秒ごとにログ
      logger.info("Polling video generation", {attempt: attempt + 1, done: result.done});
    }

    if (result.done) {
      if (result.error) {
        throw new Error(`Video generation failed: ${result.error.message}`);
      }

      const videos = result.response?.videos;
      if (!videos || videos.length === 0) {
        throw new Error("No video returned from Veo 3.1");
      }

      return videos[0].gcsUri;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Video generation timed out");
}

/**
 * GCSからファイルをダウンロード
 */
async function downloadFromGcs(gcsUri: string, destPath: string): Promise<void> {
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid GCS URI: ${gcsUri}`);
  }

  const bucketName = match[1];
  const filePath = match[2];

  const bucket = admin.storage().bucket(bucketName);
  await bucket.file(filePath).download({destination: destPath});
}

/**
 * サムネイル生成
 */
function generateThumbnail(videoPath: string, thumbnailPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ["00:00:00"],
        filename: path.basename(thumbnailPath),
        folder: path.dirname(thumbnailPath),
        size: "512x512",
      })
      .on("end", () => resolve())
      .on("error", (err) => reject(err));
  });
}

/**
 * ファイルをStorageにアップロード
 */
async function uploadToStorage(
  filePath: string,
  storagePath: string,
  contentType: string
): Promise<string> {
  const bucket = admin.storage().bucket();

  await bucket.upload(filePath, {
    destination: storagePath,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: generateUUID(),
      },
    },
  });

  const file = bucket.file(storagePath);
  const [metadata] = await file.getMetadata();
  const token = metadata.metadata?.firebaseStorageDownloadTokens;

  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
    `/o/${encodedPath}?alt=media&token=${token}`;
}

/**
 * UUID生成
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
