import * as admin from "firebase-admin";

// Firebase Admin 初期化（まだの場合）
if (!admin.apps.length) {
  admin.initializeApp();
}

const bucket = admin.storage().bucket("kirokuma-c2d24.firebasestorage.app");

/**
 * 画像を Storage にアップロードして公開 URL を返す
 */
export async function uploadImage(
  data: Buffer,
  path: string,
  contentType = "image/png"
): Promise<string> {
  const file = bucket.file(path);

  await file.save(data, {
    metadata: {
      contentType,
    },
  });

  // 公開アクセスを許可
  await file.makePublic();

  // 公開 URL を返す
  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}

/**
 * Storage から画像をダウンロードして Base64 文字列を返す
 */
export async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  // URL からパスを抽出
  const prefix = `https://storage.googleapis.com/${bucket.name}/`;
  if (!imageUrl.startsWith(prefix)) {
    throw new Error(`Invalid storage URL: ${imageUrl}`);
  }
  const filePath = imageUrl.slice(prefix.length);

  const file = bucket.file(filePath);
  const [buffer] = await file.download();
  return buffer.toString("base64");
}
