/**
 * 料理カテゴリ
 */
export type DishCategory = "main" | "side" | "staple" | "soup";

/**
 * 量
 */
export type Portion = "small" | "medium" | "large";

/**
 * 1つの料理
 */
export interface Dish {
  /** 料理名 例: "鮭の塩焼き" */
  name: string;
  /** カテゴリ */
  category: DishCategory;
  /** 食材リスト */
  ingredients: string[];
  /** 量 */
  portion: Portion;
}

/**
 * 食事分析結果
 * Gemini が食事画像から抽出する情報
 */
export interface MealAnalysis {
  /** 料理リスト（1回の食事に複数の料理） */
  dishes: Dish[];
}

/**
 * Firestore: users コレクション
 */
export interface User {
  id: string;
  lineUserId: string;
  createdAt: Date;
}

/**
 * Firestore: bears コレクション
 */
export interface Bear {
  id: string;
  userId: string;
  imageUrl: string;
  createdAt: Date;
}

/**
 * Firestore: meals コレクション
 */
export interface Meal {
  id: string;
  userId: string;
  bearId: string;
  imageUrl: string;
  analyzedData: MealAnalysis;
  createdAt: Date;
}
