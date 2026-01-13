# くまパラメータ計算仕様

## 概要

食事画像から分析されたデータ（MealAnalysis）を元に、くまのパラメータ（BearParameters）を更新する。

---

## 設計方針: ハイブリッドアプローチ

```
┌─────────────────────────────────────────────────────────┐
│  MealAnalysis                                            │
├─────────────────────────────────────────────────────────┤
│  【数値データ】→ 体型・元気度などの「安定したベース」     │
│  【テキストデータ】→ 見た目・特徴の「自由な表現」        │
└─────────────────────────────────────────────────────────┘
```

---

## 入力データ

### MealAnalysis（現在）

| フィールド | 型 | 用途 | 問題点 |
|-----------|-----|------|--------|
| menuName | string | 性格推定 | ◯ 活用できてる |
| ingredients | string[] | アクセサリのみ | △ もっと活用できる |
| colors | Record<string, number> | くまの色 | ◯ |
| nutrition.balance | number | 体型計算 | △ 曖昧 |
| nutrition.protein | number | 筋肉計算 | △ 単純すぎ |
| nutrition.vegetable | number | 元気度計算 | △ 野菜=元気？ |
| volume | "small"\|"medium"\|"large" | 元気度のみ | △ 体型に使うべき |

### MealAnalysis（再設計案）

```typescript
interface MealAnalysis {
  // === テキスト系（自由な表現用）===

  /** メニュー名 */
  menuName: string;

  /** 食材リスト */
  ingredients: string[];

  /** 料理の特徴（自由記述）例: "和風", "こってり", "彩り豊か" */
  characteristics: string[];

  /** 写真の主な色（HEXコード上位3色） */
  dominantColors: string[];

  // === 数値系（安定した計算用）===

  /** 食事量スコア 0-100（カロリーの代替指標） */
  volumeScore: number;

  /** 栄養バランススコア 0-100 */
  balanceScore: number;

  /** 健康度スコア 0-100（野菜・タンパク質・バランスの総合） */
  healthScore: number;
}
```

### 変更点まとめ

| 変更 | 理由 |
|------|------|
| `colors` → `dominantColors` (string[]) | 割合は不要、色だけで十分 |
| `volume` → `volumeScore` (number) | 3段階より連続値の方が計算しやすい |
| `nutrition.*` → 統合 | 細かすぎ、healthScore 1つで十分 |
| `characteristics` 追加 | 見た目の自由な表現用 |
| `protein`, `vegetable` 削除 | healthScore に統合 |

---

## 出力データ

### BearParameters（現在）

| フィールド | 型 | 説明 | 初期値 |
|-----------|-----|------|--------|
| colors | Record<string, number> | 累積された色 | {} |
| bodyType | number (0-100) | 体型（0:スリム ↔ 100:ぽっちゃり） | 50 |
| muscle | number (0-100) | 筋肉量 | 50 |
| energy | number (0-100) | 元気度 | 50 |
| personality | string[] | 性格特徴（最大5件） | [] |
| accessories | string[] | アクセサリ（最大5件） | [] |

### BearParameters（再設計案）

```typescript
interface BearParameters {
  // === 数値パラメータ（安定性重視）===

  /** 体型 0-100（0:スリム ↔ 100:ぽっちゃり） */
  bodyType: number;

  /** コンディション 0-100（元気度・健康状態） */
  condition: number;

  // === テキストパラメータ（自由度重視）===

  /** 累積された色（上位5色） */
  colors: string[];

  /** 最近の食事の特徴（画像生成に直接渡す） */
  recentCharacteristics: string[];

  /** 見た目の特徴（アクセサリ的なもの） */
  appearance: string[];
}
```

### 変更点まとめ

| 変更 | 理由 |
|------|------|
| `muscle` 削除 | 食事だけで筋肉は決まらない、シンプルに |
| `energy` → `condition` | より汎用的な名前に |
| `colors` の型変更 | 割合の管理が複雑、色リストで十分 |
| `personality` 削除 | `recentCharacteristics` に統合 |
| `accessories` → `appearance` | より自由な表現へ |

---

## 計算ロジック（再設計案）

### 基本方針

```
【数値】シンプルに、直感的に
【テキスト】AIに任せて、自由に
```

---

### 1. bodyType（体型）

**新しい仕様:**
- 入力: `volumeScore`（食事量）
- 計算: たくさん食べると太る、少ないと痩せる（シンプル！）

```typescript
// 50が基準、それより多いと太る方向、少ないと痩せる方向
mealEffect = volumeScore
newValue = current * 0.9 + mealEffect * 0.1
```

**ポイント:**
- 栄養バランスは関係なし（バランス悪くても量が少なければ太らない）
- 変化を緩やかに（0.9 / 0.1）

---

### 2. condition（コンディション）

**新しい仕様:**
- 入力: `healthScore`（健康度）+ `balanceScore`（バランス）
- 計算: 健康的な食事で元気に、ジャンクフードで下がる

```typescript
mealEffect = (healthScore + balanceScore) / 2
newValue = current * 0.8 + mealEffect * 0.2
```

**ポイント:**
- 野菜だけでなく、総合的な健康度で判断
- くまの表情や元気さに影響

---

### 3. colors（色）

**新しい仕様:**
- 入力: `dominantColors`
- 計算: 最近の食事の色を蓄積（最新が優先）

```typescript
// 新しい色を先頭に追加、重複排除、上位5色まで
colors = [...new Set([...newColors, ...currentColors])].slice(0, 5)
```

---

### 4. recentCharacteristics（最近の特徴）

**新しい仕様:**
- 入力: `characteristics` + `menuName` + `ingredients`
- 計算: 直近3〜5食の特徴を保持

```typescript
// AIが抽出した特徴をそのまま蓄積
// 例: ["和風", "魚料理好き", "野菜たっぷり", "彩り豊か"]
```

**ポイント:**
- これを画像生成プロンプトに直接渡す
- AIの自由な表現を活かす

---

### 5. appearance（見た目）

**新しい仕様:**
- 入力: `ingredients` から特徴的なものを抽出
- 計算: 特定の食材パターンで見た目が変化

```typescript
// 例: 鮭をよく食べる → 鮭色の模様
//     野菜多め → 緑の葉っぱアクセサリ
```

---

## 画像生成プロンプトへの反映

### 現在のプロンプト構造

```
体型: bodyType → "chubby" / "normal" / "slim"
筋肉: muscle → "muscular"
元気: energy → "energetic" / "happy" / "sleepy"
色: colors → "fur colors inspired by #xxx"
性格: personality → "with a xxx personality"
アクセサリ: accessories → "wearing xxx"
```

### 新しいプロンプト構造（案）

```typescript
function buildPrompt(params: BearParameters, meal: MealAnalysis): string {
  // 数値から安定したベースを生成
  const bodyDesc = params.bodyType > 60 ? "chubby" :
                   params.bodyType < 40 ? "slim" : "normal";

  const moodDesc = params.condition > 70 ? "very happy and energetic" :
                   params.condition < 30 ? "a bit tired" : "content";

  // テキストから自由な表現を生成
  const colorDesc = params.colors.length > 0 ?
    `with fur inspired by ${params.colors.slice(0, 3).join(", ")}` : "";

  const characterDesc = params.recentCharacteristics.length > 0 ?
    `This bear loves ${params.recentCharacteristics.join(", ")} food` : "";

  const appearanceDesc = params.appearance.length > 0 ?
    `with ${params.appearance.join(", ")}` : "";

  // 今回の食事を直接反映（ハイブリッドの肝）
  const todayMeal = `Today the bear just ate ${meal.menuName}`;

  return `
    A cute cartoon bear, kawaii style.
    ${bodyDesc} body, looking ${moodDesc}.
    ${colorDesc}
    ${characterDesc}
    ${appearanceDesc}
    ${todayMeal}
  `;
}
```

---

## 次のステップ

1. [ ] MealAnalysis の型を更新
2. [ ] mealAnalyzer.ts のプロンプトを更新
3. [ ] BearParameters の型を更新
4. [ ] bearCalculator.ts の計算ロジックを更新
5. [ ] bearGenerator.ts のプロンプト生成を更新
