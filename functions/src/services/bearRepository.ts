import * as admin from "firebase-admin";
import {Bear, BearParameters, INITIAL_BEAR_PARAMETERS} from "../models";

// Firebase Admin 初期化（まだの場合）
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bearsCollection = db.collection("bears");

// 仮実装用の固定ユーザーID
const TEST_USER_ID = "test-user";

/**
 * ユーザーの最新のくまを取得
 * 存在しない場合は null を返す
 */
export async function getLatestBear(userId: string = TEST_USER_ID): Promise<Bear | null> {
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
    parameters: data.parameters as BearParameters,
    createdAt: data.createdAt.toDate(),
  };
}

/**
 * 新しいくまを保存
 */
export async function saveBear(
  imageUrl: string,
  parameters: BearParameters,
  userId: string = TEST_USER_ID
): Promise<Bear> {
  const now = admin.firestore.Timestamp.now();

  const docRef = await bearsCollection.add({
    userId,
    imageUrl,
    parameters,
    createdAt: now,
  });

  return {
    id: docRef.id,
    userId,
    imageUrl,
    parameters,
    createdAt: now.toDate(),
  };
}

/**
 * ユーザーがくまを持っているかチェック（初回判定用）
 */
export async function hasBear(userId: string = TEST_USER_ID): Promise<boolean> {
  const bear = await getLatestBear(userId);
  return bear !== null;
}

/**
 * 初期くまパラメータを取得
 */
export function getInitialParameters(): BearParameters {
  return {...INITIAL_BEAR_PARAMETERS};
}