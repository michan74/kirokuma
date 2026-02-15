import * as admin from "firebase-admin";
import {Bear, Meal, MealAnalysis} from "../models";
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
 * グループ内の直近のくま画像を取得
 */
export async function getRecentBears(
  userId: string,
  groupId: string,
  limit = 10
): Promise<Bear[]> {
  const snapshot = await bearsCollection
    .where("userId", "==", userId)
    .where("groupId", "==", groupId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      groupId: data.groupId,
      imageUrl: data.imageUrl,
      createdAt: data.createdAt.toDate(),
    };
  });
}

/**
 * クマと食事の組み合わせ
 */
export interface BearWithMeal {
  bear: Bear;
  meal: Meal | null;
}

/**
 * グループ内の直近のくま画像と対応する食事を取得（最大30件）
 */
export async function getRecentBearsWithMeals(
  userId: string,
  groupId: string,
  limit = 30
): Promise<BearWithMeal[]> {
  const maxLimit = Math.min(limit, 30);

  // クマを取得
  const bearsSnapshot = await bearsCollection
    .where("userId", "==", userId)
    .where("groupId", "==", groupId)
    .orderBy("createdAt", "desc")
    .limit(maxLimit)
    .get();

  const bears = bearsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      groupId: data.groupId,
      imageUrl: data.imageUrl,
      createdAt: data.createdAt.toDate(),
    };
  });

  if (bears.length === 0) {
    return [];
  }

  // 対応する食事を一括取得
  const bearIds = bears.map((b) => b.id);
  const mealsCollection = db.collection("meals");
  const mealsSnapshot = await mealsCollection
    .where("bearId", "in", bearIds)
    .get();

  const mealMap = new Map<string, Meal>();
  for (const doc of mealsSnapshot.docs) {
    const data = doc.data();
    mealMap.set(data.bearId, {
      id: doc.id,
      userId: data.userId,
      groupId: data.groupId,
      bearId: data.bearId,
      analyzedData: data.analyzedData as MealAnalysis,
      imageUrl: data.imageUrl as string | undefined,
      dishEmbedding: data.dishEmbedding as number[] | undefined,
      createdAt: data.createdAt.toDate(),
    });
  }

  // クマと食事を結合
  return bears.map((bear) => ({
    bear,
    meal: mealMap.get(bear.id) || null,
  }));
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
