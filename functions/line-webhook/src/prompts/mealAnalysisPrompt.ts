/**
 * 食事画像分析用プロンプト
 */
export const MEAL_ANALYSIS_PROMPT = `
Analyze this photo.
Return ONLY JSON. No explanation needed.
All text output MUST be in Japanese.

=== If NOT food ===
If the photo does not contain food:
{"isFood": false}

=== If food ===
If the photo contains food:

{
  "isFood": true,
  "dish": "メイン料理名",
  "ingredients": ["食材1", "食材2", "食材3"],
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"]
}

=== dish ===
The main dish name (1 only). Output in Japanese.

=== ingredients ===
List all ingredients in the photo (3-8 items).
Include ingredients from side dishes and soup.
Output in Japanese.

=== tags ===
Tag the overall impression of the meal (5-8 tags).
Include impressions from side dishes and soup.
Output in Japanese.

Tag categories (mix freely):
- Genre
- Atmosphere
- Scene
- Emotion
- Season
- Color
- Texture
- Temperature
`;
