/**
 * 食事分析結果
 * Gemini が食事画像から抽出する情報
 */
export interface MealAnalysis {
  /** メニュー名 例: "鮭の塩焼き定食" */
  menuName: string;

  /** 食材リスト 例: ["鮭", "ご飯", "味噌汁", "漬物"] */
  ingredients: string[];

  /** 写真の色味（上位3色） 例: { "#FA8072": 40, "#2E8B57": 30 } */
  colors: Record<string, number>;

  /** 栄養スコア */
  nutrition: {
    /** 栄養バランススコア 0-100 */
    balance: number;
    /** タンパク質スコア 0-100 */
    protein: number;
    /** 野菜スコア 0-100 */
    vegetable: number;
  };

  /** 食事量 */
  volume: "small" | "medium" | "large";
}

/**
 * くまパラメータ
 * DBに累積保存される、くまの状態を表すパラメータ
 */
export interface BearParameters {
  /** 累積された色 例: { "#FA8072": 35, "#2E8B57": 25 } */
  colors: Record<string, number>;

  /** 体型 0-100（0:スリム, 100:ぽっちゃり） */
  bodyType: number;

  /** 筋肉 0-100 */
  muscle: number;

  /** 元気度 0-100 */
  energy: number;

  /** 性格特徴 例: ["和風", "健康的"] */
  personality: string[];

  /** アクセサリ 例: ["鮭模様", "緑の葉っぱ"] */
  accessories: string[];
}

/**
 * 初期くまパラメータ
 * 新規ユーザーのくまはこの状態からスタート
 */
export const INITIAL_BEAR_PARAMETERS: BearParameters = {
  colors: {},
  bodyType: 50,
  muscle: 50,
  energy: 50,
  personality: [],
  accessories: [],
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
  parameters: BearParameters;
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
