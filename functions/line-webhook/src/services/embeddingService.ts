import {GoogleGenAI} from "@google/genai";

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
  if (embeddings.length < 2) return "weak";

  // 全ペアの類似度を計算
  let highSimilarityCount = 0;
  let totalPairs = 0;

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      if (similarity >= threshold) {
        highSimilarityCount++;
      }
      totalPairs++;
    }
  }

  const ratio = highSimilarityCount / totalPairs;

  // 60%以上のペアが高類似度 → strong
  if (ratio >= 0.6) return "strong";
  // 30%以上 → medium
  if (ratio >= 0.3) return "medium";
  return "weak";
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
