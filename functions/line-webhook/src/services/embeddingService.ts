import {GoogleGenAI} from "@google/genai";
import * as logger from "firebase-functions/logger";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "";
const LOCATION = "us-central1";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

/**
 * テキストをEmbeddingベクトルに変換
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });

  return response.embeddings?.[0]?.values || [];
}

/**
 * タグ配列をまとめてEmbedding化
 */
export async function getTagsEmbedding(tags: string[]): Promise<number[]> {
  const text = tags.join(", ");
  return getEmbedding(text);
}

/**
 * 2つのベクトルのコサイン類似度を計算
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * 類似度行列から強い傾向を検出
 * @param embeddings 過去の食事のembedding配列
 * @param threshold 類似度の閾値（デフォルト0.8）
 * @returns 傾向の強さ: "strong" | "medium" | "weak"
 */
export function detectTrendStrength(
  embeddings: number[][],
  threshold = 0.8
): "strong" | "medium" | "weak" {
  if (embeddings.length < 2) {
    logger.info("detectTrendStrength: Not enough embeddings", {count: embeddings.length});
    return "weak";
  }

  // 全ペアの類似度を計算
  let highSimilarityCount = 0;
  let totalPairs = 0;
  const similarities: {pair: string; similarity: number}[] = [];

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      similarities.push({pair: `${i}-${j}`, similarity: Math.round(similarity * 1000) / 1000});
      if (similarity >= threshold) {
        highSimilarityCount++;
      }
      totalPairs++;
    }
  }

  const ratio = highSimilarityCount / totalPairs;

  // 結果を判定
  let result: "strong" | "medium" | "weak";
  if (ratio >= 0.6) {
    result = "strong";
  } else if (ratio >= 0.3) {
    result = "medium";
  } else {
    result = "weak";
  }

  logger.info("detectTrendStrength: Analysis complete", {
    totalMeals: embeddings.length,
    totalPairs,
    highSimilarityCount,
    ratio: Math.round(ratio * 100) / 100,
    threshold,
    result,
    similarities,
  });

  return result;
}

/**
 * 複数のembeddingの平均ベクトルを計算（傾向の中心）
 */
export function averageEmbedding(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    avg[i] /= embeddings.length;
  }

  return avg;
}

/**
 * 料理名とEmbeddingのペア
 */
interface DishWithEmbedding {
  dish: string;
  embedding: number[];
}

/**
 * クラスタリング結果
 */
export interface ClusterResult {
  /** 最大クラスターの料理名リスト */
  trendDishes: string[];
  /** 傾向の強さ */
  strength: "strong" | "medium" | "weak";
  /** クラスター数 */
  clusterCount: number;
}

/**
 * 料理名をクラスタリングしてトレンドを検出
 * @param dishes 料理名とEmbeddingの配列
 * @param threshold 類似度の閾値（デフォルト0.75）
 */
export function clusterDishes(
  dishes: DishWithEmbedding[],
  threshold = 0.75
): ClusterResult {
  if (dishes.length === 0) {
    return {trendDishes: [], strength: "weak", clusterCount: 0};
  }

  if (dishes.length === 1) {
    return {trendDishes: [dishes[0].dish], strength: "weak", clusterCount: 1};
  }

  // Union-Findでクラスタリング
  const parent: number[] = dishes.map((_, i) => i);

  const find = (x: number): number => {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]);
    }
    return parent[x];
  };

  const union = (x: number, y: number): void => {
    const px = find(x);
    const py = find(y);
    if (px !== py) {
      parent[px] = py;
    }
  };

  // 類似度が閾値以上のペアを同じクラスターに
  for (let i = 0; i < dishes.length; i++) {
    for (let j = i + 1; j < dishes.length; j++) {
      const similarity = cosineSimilarity(dishes[i].embedding, dishes[j].embedding);
      if (similarity >= threshold) {
        union(i, j);
      }
    }
  }

  // クラスターごとに料理名を集める
  const clusters: Map<number, string[]> = new Map();
  for (let i = 0; i < dishes.length; i++) {
    const root = find(i);
    if (!clusters.has(root)) {
      clusters.set(root, []);
    }
    clusters.get(root)!.push(dishes[i].dish);
  }

  // 最大クラスターを見つける
  let maxCluster: string[] = [];
  for (const cluster of clusters.values()) {
    if (cluster.length > maxCluster.length) {
      maxCluster = cluster;
    }
  }

  // 傾向の強さを判定
  const ratio = maxCluster.length / dishes.length;
  let strength: "strong" | "medium" | "weak";
  if (ratio >= 0.6) {
    strength = "strong";
  } else if (ratio >= 0.4) {
    strength = "medium";
  } else {
    strength = "weak";
  }

  logger.info("clusterDishes: Analysis complete", {
    totalDishes: dishes.length,
    clusterCount: clusters.size,
    maxClusterSize: maxCluster.length,
    ratio: Math.round(ratio * 100) / 100,
    strength,
    trendDishes: maxCluster,
  });

  return {
    trendDishes: maxCluster,
    strength,
    clusterCount: clusters.size,
  };
}
