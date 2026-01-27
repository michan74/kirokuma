import * as admin from "firebase-admin";
import {Meal, MealAnalysis} from "../models";

const db = admin.firestore();
const mealsCollection = db.collection("meals");

/**
 * 食事分析結果を保存
 */
export async function saveMeal(
  imageUrl: string,
  analyzedData: MealAnalysis,
  bearId: string,
  userId: string
): Promise<Meal> {
  const now = admin.firestore.Timestamp.now();

  const docRef = await mealsCollection.add({
    userId,
    bearId,
    imageUrl,
    analyzedData,
    createdAt: now,
  });

  return {
    id: docRef.id,
    userId,
    bearId,
    imageUrl,
    analyzedData,
    createdAt: now.toDate(),
  };
}

/**
 * ユーザーの直近N日間の食事履歴を取得
 */
export async function getRecentMeals(
  userId: string,
  days = 7
): Promise<Meal[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);

  const snapshot = await mealsCollection
    .where("userId", "==", userId)
    .where("createdAt", ">=", startTimestamp)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      bearId: data.bearId,
      imageUrl: data.imageUrl,
      analyzedData: data.analyzedData as MealAnalysis,
      createdAt: data.createdAt.toDate(),
    };
  });
}

/**
 * ユーザーの食事回数を取得
 */
export async function getMealCount(userId: string): Promise<number> {
  const snapshot = await mealsCollection
    .where("userId", "==", userId)
    .count()
    .get();

  return snapshot.data().count;
}
