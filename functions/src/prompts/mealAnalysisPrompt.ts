/**
 * 食事画像分析用プロンプト
 */
export const MEAL_ANALYSIS_PROMPT = `
この食事の写真を分析して、以下のJSON形式で回答してください。
必ずJSONのみを返してください。説明文は不要です。

{
  "menuName": "料理名",
  "ingredients": ["食材1", "食材2", "食材3"]
}

注意:
- menuName: 料理名を日本語で記述（例: "鮭の塩焼き定食", "カレーライス"）
- ingredients: 主な食材を3〜5個抽出
`;
