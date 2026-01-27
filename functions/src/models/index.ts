/**
 * 食事分析結果
 * Gemini が食事画像から抽出する情報
 */
export interface MealAnalysis {
  /** メニュー名 例: "鮭の塩焼き定食" */
  menuName: string;

  /** 食材リスト 例: ["鮭", "ご飯", "味噌汁", "漬物"] */
  ingredients: string[];
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
