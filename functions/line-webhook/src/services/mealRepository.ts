import * as admin from "firebase-admin";
import {Meal, MealAnalysis} from "../models";
import {getTagsEmbedding} from "./embeddingService";

const db = admin.firestore();
const mealsCollection = db.collection("meals");

/**
 * 食事分析結果を保存（タグのEmbeddingも計算して保存）
 */
export async function saveMeal(
  imageUrl: string,
  analyzedData: MealAnalysis,
  bearId: string,
  groupId: string,
  userId: string
): Promise<Meal> {
  const now = admin.firestore.Timestamp.now();

  // 3つに分けてEmbedding化
  const dishNames = [analyzedData.dish];
  const ingredients = analyzedData.ingredients;

  const [tagsEmbedding, dishesEmbedding, ingredientsEmbedding] = await Promise.all([
    getTagsEmbedding(analyzedData.tags),
    getTagsEmbedding(dishNames),
    getTagsEmbedding(ingredients),
  ]);

  const docRef = await mealsCollection.add({
    userId,
    groupId,
    bearId,
    imageUrl,
    analyzedData,
    tagsEmbedding,
    dishesEmbedding,
    ingredientsEmbedding,
    createdAt: now,
  });

  return {
    id: docRef.id,
    userId,
    groupId,
    bearId,
    imageUrl,
    analyzedData,
    tagsEmbedding,
    dishesEmbedding,
    ingredientsEmbedding,
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
      imageUrl: data.imageUrl,
      analyzedData: data.analyzedData as MealAnalysis,
      tagsEmbedding: data.tagsEmbedding as number[] | undefined,
      dishesEmbedding: data.dishesEmbedding as number[] | undefined,
      ingredientsEmbedding: data.ingredientsEmbedding as number[] | undefined,
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
