import * as admin from "firebase-admin";
import {Bear} from "../models";

// Firebase Admin 初期化（まだの場合）
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bearsCollection = db.collection("bears");

/**
 * 新しいくまを保存
 */
export async function saveBear(
  imageUrl: string,
  userId: string
): Promise<Bear> {
  const now = admin.firestore.Timestamp.now();

  const docRef = await bearsCollection.add({
    userId,
    imageUrl,
    createdAt: now,
  });

  return {
    id: docRef.id,
    userId,
    imageUrl,
    createdAt: now.toDate(),
  };
}
