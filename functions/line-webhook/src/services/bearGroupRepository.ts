import * as admin from "firebase-admin";
import {BearGroup} from "../models";

const db = admin.firestore();
const bearGroupsCollection = db.collection("bear_groups");

/**
 * ユーザーのアクティブなグループを取得（endedAtがないもの）
 */
export async function getActiveGroup(userId: string): Promise<BearGroup | null> {
  const snapshot = await bearGroupsCollection
    .where("userId", "==", userId)
    .where("endedAt", "==", null)
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
    createdAt: data.createdAt.toDate(),
    endedAt: data.endedAt?.toDate(),
  };
}

/**
 * ユーザーのアクティブなグループを取得、なければ作成
 */
export async function getOrCreateActiveGroup(userId: string): Promise<BearGroup> {
  const existing = await getActiveGroup(userId);
  if (existing) {
    return existing;
  }

  return createGroup(userId);
}

/**
 * 新しいグループを作成
 */
export async function createGroup(userId: string): Promise<BearGroup> {
  const now = admin.firestore.Timestamp.now();

  const docRef = await bearGroupsCollection.add({
    userId,
    createdAt: now,
    endedAt: null,
  });

  return {
    id: docRef.id,
    userId,
    createdAt: now.toDate(),
  };
}

/**
 * グループを終了（転生時に呼ばれる）
 */
export async function endGroup(groupId: string): Promise<void> {
  const now = admin.firestore.Timestamp.now();

  await bearGroupsCollection.doc(groupId).update({
    endedAt: now,
  });
}

/**
 * 転生処理: 現在のグループを終了し、新しいグループを作成
 */
export async function reincarnate(userId: string): Promise<BearGroup> {
  const activeGroup = await getActiveGroup(userId);

  if (activeGroup) {
    await endGroup(activeGroup.id);
  }

  return createGroup(userId);
}
