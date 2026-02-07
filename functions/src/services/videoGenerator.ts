import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";

/**
 * 複数のくま画像から動画を生成する
 * @param bearImageUrls - くま画像のURLリスト（時系列順）
 * @param userId - ユーザーID
 * @returns 生成された動画のURL
 */
export async function generateVideoFromBears(
  bearImageUrls: string[],
  userId: string
): Promise<string> {
  if (bearImageUrls.length < 2) {
    throw new Error("At least 2 images are required to generate a video");
  }

  const tempDir = path.join(os.tmpdir(), `video-${Date.now()}`);
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    // 1. 一時ディレクトリを作成
    await fs.mkdir(tempDir, {recursive: true});
    logger.info("Created temp directory", {tempDir});

    // 2. 画像をダウンロードして一時ファイルとして保存
    const imagePaths: string[] = [];
    for (let i = 0; i < bearImageUrls.length; i++) {
      const imagePath = path.join(tempDir, `bear_${i}.png`);
      await downloadImageToFile(bearImageUrls[i], imagePath);
      imagePaths.push(imagePath);
      logger.info("Downloaded image", {index: i, path: imagePath});
    }

    // 3. ffmpegで動画生成
    await generateVideo(imagePaths, outputPath);
    logger.info("Video generated", {outputPath});

    // 4. 生成した動画をStorageにアップロード
    const timestamp = Date.now();
    const videoUrl = await uploadVideoToStorage(outputPath, `videos/${userId}/${timestamp}.mp4`);
    logger.info("Video uploaded to Storage", {videoUrl});

    // 5. 一時ファイルをクリーンアップ
    await fs.rm(tempDir, {recursive: true, force: true});
    logger.info("Cleaned up temp directory");

    return videoUrl;
  } catch (error) {
    // エラー時もクリーンアップ
    try {
      await fs.rm(tempDir, {recursive: true, force: true});
    } catch (cleanupError) {
      logger.error("Failed to cleanup temp directory", {error: cleanupError});
    }
    throw error;
  }
}

/**
 * URLから画像をダウンロードしてファイルに保存
 * Firebase Storageの画像はAdmin SDKを使ってダウンロード
 */
async function downloadImageToFile(url: string, filePath: string): Promise<void> {
  try {
    // Firebase StorageのURLからパスを抽出
    // 形式1: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
    // 形式2: https://storage.googleapis.com/{bucket}/{path}
    const urlObj = new URL(url);
    let storagePath: string;

    if (urlObj.hostname === "firebasestorage.googleapis.com") {
      // 形式1: /v0/b/{bucket}/o/{path} から {path} を抽出
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
      if (!pathMatch) {
        throw new Error(`Invalid Firebase Storage URL format: ${url}`);
      }
      storagePath = decodeURIComponent(pathMatch[1]);
    } else if (urlObj.hostname === "storage.googleapis.com") {
      // 形式2: /{bucket}/{path} から {path} を抽出
      const pathParts = urlObj.pathname.split("/").filter((p) => p);
      // 最初の要素はバケット名なので除外
      storagePath = pathParts.slice(1).join("/");
    } else {
      throw new Error(`Unsupported storage URL format: ${url}`);
    }

    // Firebase Admin SDKで画像をダウンロード
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.download({destination: filePath});

    logger.info("Downloaded image from Storage", {storagePath, filePath});
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to download image", {url, error: errorMessage});
    throw new Error(`Failed to download image: ${errorMessage}`);
  }
}

/**
 * ffmpegで動画生成（ズーム効果 + クロスフェード）
 */
function generateVideo(imagePaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const imageCount = imagePaths.length;

    // ズーム効果の設定
    const zoompanFilters: string[] = [];
    for (let i = 0; i < imageCount; i++) {
      zoompanFilters.push(
        `[${i}:v]zoompan=z='min(zoom+0.0015,1.5)':d=125:s=1024x1024[v${i}]`
      );
    }

    // クロスフェードの設定
    const xfadeFilters: string[] = [];
    for (let i = 0; i < imageCount - 1; i++) {
      const inputLabel = i === 0 ? `[v${i}]` : `[vv${i - 1}]`;
      const outputLabel = i === imageCount - 2 ? "[out]" : `[vv${i}]`;
      const offset = 1.5 + (i * 2); // 各画像の表示開始位置
      xfadeFilters.push(
        `${inputLabel}[v${i + 1}]xfade=transition=fade:duration=0.5:offset=${offset}${outputLabel}`
      );
    }

    // フィルタコンプレックスを結合
    const filterComplex = [...zoompanFilters, ...xfadeFilters].join("; ");

    // ffmpegコマンドを構築
    let command = ffmpeg();

    // 各画像を入力として追加
    for (const imagePath of imagePaths) {
      command = command.input(imagePath).inputOptions(["-loop 1", "-t 2"]);
    }

    // フィルタとエンコード設定を追加
    command
      .complexFilter(filterComplex)
      .outputOptions([
        "-map [out]",
        "-c:v libx264",
        "-pix_fmt yuv420p",
        "-movflags +faststart", // Web再生用の最適化
      ])
      .output(outputPath)
      .on("start", (commandLine) => {
        logger.info("ffmpeg command started", {command: commandLine});
      })
      .on("progress", (progress) => {
        logger.info("ffmpeg progress", {percent: progress.percent});
      })
      .on("end", () => {
        logger.info("ffmpeg finished successfully");
        resolve();
      })
      .on("error", (err) => {
        logger.error("ffmpeg error", {error: err.message});
        reject(new Error(`Video generation failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * 動画をCloud Storageにアップロード
 */
async function uploadVideoToStorage(filePath: string, storagePath: string): Promise<string> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  await bucket.upload(filePath, {
    destination: storagePath,
    metadata: {
      contentType: "video/mp4",
      metadata: {
        firebaseStorageDownloadTokens: generateUUID(),
      },
    },
  });

  // 公開URLを生成
  const token = (await file.getMetadata())[0].metadata?.firebaseStorageDownloadTokens;
  const bucketName = bucket.name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/ \
    ${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

/**
 * UUID生成（Firebase Storage用）
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
