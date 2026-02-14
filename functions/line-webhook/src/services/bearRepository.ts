import * as admin from "firebase-admin";
import {Bear} from "../models";
import {getOrCreateActiveGroup} from "./bearGroupRepository";

// Firebase Admin 初期化（まだの場合）
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bearsCollection = db.collection("bears");

/**
 * ユーザーの最新のくまを取得（現在のグループから）
 */
export async function getLatestBear(
  userId: string,
  groupId?: string
): Promise<Bear | null> {
  let query = bearsCollection
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(1);

  if (groupId) {
    query = bearsCollection
      .where("userId", "==", userId)
      .where("groupId", "==", groupId)
      .orderBy("createdAt", "desc")
      .limit(1);
  }

  const snapshot = await query.get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId,
    groupId: data.groupId,
    imageUrl: data.imageUrl,
    createdAt: data.createdAt.toDate(),
  };
}

/**
 * 新しいくまを保存（自動的にアクティブグループに所属）
 */
export async function saveBear(
  imageUrl: string,
  userId: string
): Promise<Bear> {
  const now = admin.firestore.Timestamp.now();

  // アクティブなグループを取得（なければ作成）
  const group = await getOrCreateActiveGroup(userId);

  const docRef = await bearsCollection.add({
    userId,
    groupId: group.id,
    imageUrl,
    createdAt: now,
  });

  return {
    id: docRef.id,
    userId,
    groupId: group.id,
    imageUrl,
    createdAt: now.toDate(),
  };
}
