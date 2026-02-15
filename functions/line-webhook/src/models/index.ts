/**
 * 料理クラスタリング結果
 */
export interface DishClusterResult {
  /** 最大クラスターの料理名リスト */
  trendDishes: string[];
  /** 傾向の強さ */
  strength: "strong" | "medium" | "weak";
  /** クラスター数 */
  clusterCount: number;
}

/**
 * タグ・食材の傾向（Gemini分析結果）
 */
export interface TextTrendResult {
  /** 雰囲気の傾向 */
  moodTrend: string;
  /** 食材の傾向 */
  ingredientTrend: string;
}

/**
 * 総合的な傾向分析結果
 */
export interface TrendAnalysis {
  /** 料理ジャンルの傾向（クラスタリング結果） */
  dishes: DishClusterResult;
  /** タグ・食材の傾向（Gemini分析） */
  textTrends: TextTrendResult;
}

/**
 * 食事分析結果
 * Gemini が食事画像から抽出する情報
 */
export interface MealAnalysis {
  /** メイン料理名 例: "鮭の塩焼き定食" */
  dish: string;
  /** 食材リスト（副菜・スープの材料も含む） 例: ["鮭", "ごはん", "豆腐", "わかめ"] */
  ingredients: string[];
  /** 食事から受ける印象のタグ（3〜5個） 例: ["和食", "ほっこり", "手作り感"] */
  tags: string[];
}

/**
 * 家具アイテム
 */
export interface FurnitureItem {
  /** 家具の種類 例: "ちゃぶ台", "座布団", "布団" */
  type: string;
  /** 柄・デザイン 例: "魚柄", "波柄" */
  pattern?: string;
  /** 色 例: "赤", "青" */
  color?: string;
  /** 配置場所 例: "部屋の中央", "窓際" */
  placement?: string;
  /** 上に乗っている小物 例: ["鍋", "ミトン", "ノート"] */
  items?: string[];
}

/**
 * 部屋のスタイル（Step1で生成）
 * 食材情報から生成され、画像生成に使用される
 */
export interface RoomStyle {
  /** 部屋のスタイル 例: "Japanese traditional", "Mediterranean" */
  roomStyle: string;
  /** 壁紙の色・パターン 例: "warm terracotta with subtle wave pattern" */
  wallpaper: string;
  /** 床の色・素材 例: "warm wooden planks", "tatami mats" */
  floor: string;
  /** ラグの有無・スタイル 例: "cozy knitted rug", "none", "round woven mat" */
  rug: string;
  /** 構造化された家具リスト */
  furniture: FurnitureItem[];
  /** クマの服装 例: "linen apron over white shirt" */
  outfit: string;
  /** クマの活動・趣味 例: "painting on an easel" */
  activity: string;
  /** クマの表情 例: "focused and content" */
  expression: string;
  /** 時間帯・照明 例: "warm afternoon sunlight" */
  lighting: string;
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
 * Firestore: bear_groups コレクション
 * 転生ごとに新しいグループが作成される
 */
export interface BearGroup {
  id: string;
  userId: string;
  createdAt: Date;
  endedAt?: Date; // 転生時に設定
}

/**
 * Firestore: bears コレクション
 */
export interface Bear {
  id: string;
  userId: string;
  groupId: string; // 所属するグループ
  imageUrl: string;
  createdAt: Date;
}

/**
 * Firestore: meals コレクション
 */
export interface Meal {
  id: string;
  userId: string;
  groupId: string; // 所属するグループ
  bearId: string;
  analyzedData: MealAnalysis;
  /** 料理名のEmbedding（クラスタリング用） */
  dishEmbedding?: number[];
  createdAt: Date;
}
