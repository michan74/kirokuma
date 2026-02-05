import * as admin from "firebase-admin";
import {Bear} from "../models";

// Firebase Admin 初期化（まだの場合）
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bearsCollection = db.collection("bears");

/**
 * ユーザーの最新のくまを取得
 */
export async function getLatestBear(userId: string): Promise<Bear | null> {
  const snapshot = await bearsCollection
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    imageUrl: data.imageUrl,
    createdAt: data.createdAt.toDate(),
  };
}

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
