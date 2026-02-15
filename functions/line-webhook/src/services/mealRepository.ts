import * as admin from "firebase-admin";
import {Meal, MealAnalysis} from "../models";
import {getEmbedding} from "./embeddingService";

const db = admin.firestore();
const mealsCollection = db.collection("meals");

/**
 * 食事分析結果を保存（料理名のEmbeddingも計算して保存）
 */
export async function saveMeal(
  analyzedData: MealAnalysis,
  bearId: string,
  groupId: string,
  userId: string,
  imageUrl?: string
): Promise<Meal> {
  const now = admin.firestore.Timestamp.now();

  // 料理名だけEmbedding化（クラスタリング用）
  const dishEmbedding = await getEmbedding(analyzedData.dish);

  const docData: Record<string, unknown> = {
    userId,
    groupId,
    bearId,
    analyzedData,
    dishEmbedding,
    createdAt: now,
  };

  if (imageUrl) {
    docData.imageUrl = imageUrl;
  }

  const docRef = await mealsCollection.add(docData);

  return {
    id: docRef.id,
    userId,
    groupId,
    bearId,
    analyzedData,
    imageUrl,
    dishEmbedding,
    createdAt: now.toDate(),
  };
}

/**
 * グループ内の直近N日間の食事履歴を取得
 */
export async function getRecentMeals(
  userId: string,
  groupId: string,
  days = 7
): Promise<Meal[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);

  const snapshot = await mealsCollection
    .where("userId", "==", userId)
    .where("groupId", "==", groupId)
    .where("createdAt", ">=", startTimestamp)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      groupId: data.groupId,
      bearId: data.bearId,
      analyzedData: data.analyzedData as MealAnalysis,
      imageUrl: data.imageUrl as string | undefined,
      dishEmbedding: data.dishEmbedding as number[] | undefined,
      createdAt: data.createdAt.toDate(),
    };
  });
}

/**
 * グループ内の食事回数を取得
 */
export async function getMealCount(userId: string, groupId: string): Promise<number> {
  const snapshot = await mealsCollection
    .where("userId", "==", userId)
    .where("groupId", "==", groupId)
    .count()
    .get();

  return snapshot.data().count;
}
