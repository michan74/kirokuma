/**
 * 食事分析結果
 * Gemini が食事画像から抽出する情報
 */
export interface MealAnalysis {
  /** メニュー名 例: "鮭の塩焼き定食" */
  menuName: string;

  /** 食材リスト 例: ["鮭", "ご飯", "味噌汁", "漬物"] */
  ingredients: string[];

  /** 料理の特徴 例: ["和風", "ヘルシー", "あっさり"] */
  characteristics: string[];

  /** 料理の色（上位3色 + 割合%） 例: { "#FA8072": 40, "#FFFFFF": 35, "#228B22": 25 } */
  colors: Record<string, number>;

  /** 栄養素（上位5つ + 割合%） 例: { "タンパク質": 45, "炭水化物": 30, "ビタミン": 15 } */
  nutrition: Record<string, number>;
}

/**
 * くまパラメータ
 * 過去の食事から累積計算され、画像生成プロンプトに渡すデータ
 */
export interface BearParameters {
  /** 累積された料理の色（上位5色 + 割合%） 例: { "#FA8072": 30, "#FFFFFF": 25, ... } */
  colors: Record<string, number>;

  /** 累積された栄養素（上位5つ + 割合%） 例: { "タンパク質": 35, "炭水化物": 30, ... } */
  nutrition: Record<string, number>;

  /** 累積された特徴（重複排除） 例: ["和風", "ヘルシー", "あっさり"] */
  characteristics: string[];
}

/**
 * 初期くまパラメータ
 * 新規ユーザーのくまはこの状態からスタート
 */
export const INITIAL_BEAR_PARAMETERS: BearParameters = {
  colors: {},
  nutrition: {},
  characteristics: [],
};

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
