import {messagingApi} from "@line/bot-sdk";
import {BearWithMeal} from "./bearRepository";

type FlexMessage = messagingApi.FlexMessage;
type FlexBubble = messagingApi.FlexBubble;
type FlexCarousel = messagingApi.FlexCarousel;

interface BearInfo {
  imageUrl: string;
  createdAt: Date;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

/**
 * クマ情報の配列から LINE の Flex Message（カルーセル）を構築します。
 * - 各バブルの hero に画像を表示し、タップで画像を開きます。
 * - bears が 1 件の場合は単一バブルを返します。
 *
 * @param bears クマ情報の配列（imageUrl と createdAt を含む）
 * @param altText Alt テキスト（LINE の代替テキスト）
 */
export function buildBearFlexMessage(bears: BearInfo[], altText = "クマの歴史です"): FlexMessage {
  const maxItems = 10;
  const items = bears.slice(0, maxItems);

  const bubbles: FlexBubble[] = items.map((bear) => {
    const label = formatDate(bear.createdAt);

    const bubble: FlexBubble = {
      type: "bubble",
      hero: {
        type: "image",
        url: bear.imageUrl,
        size: "full",
        aspectMode: "cover",
        aspectRatio: "1:1",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: label,
            weight: "bold",
            size: "sm",
            wrap: true,
          },
        ],
      },
    };

    return bubble;
  });

  const contents: FlexBubble | FlexCarousel = bubbles.length === 1 ?
    bubbles[0] :
    {type: "carousel", contents: bubbles};

  return {
    type: "flex",
    altText,
    contents,
  };
}

/**
 * クマと食事画像を上下に並べたカルーセルFlexMessageを構築
 * 上: クマ画像、下: 食事画像
 */
export function buildBearWithMealFlexMessage(
  bearsWithMeals: BearWithMeal[],
  altText = "クマと食事の歴史"
): FlexMessage {
  const maxItems = 10;
  const items = bearsWithMeals.slice(0, maxItems);

  const bubbles: FlexBubble[] = items.map(({bear, meal}) => {
    const label = formatDate(bear.createdAt);
    const dishName = meal?.analyzedData?.dish || "";

    const bubble: FlexBubble = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          // 上: クマ画像
          {
            type: "image",
            url: bear.imageUrl,
            size: "full",
            aspectMode: "cover",
            aspectRatio: "1:1",
          },
          // 下: 食事画像
          {
            type: "image",
            url: meal!.imageUrl!,
            size: "full",
            aspectMode: "cover",
            aspectRatio: "1:1",
          },
          // 日付と料理名
          {
            type: "box",
            layout: "vertical",
            paddingAll: "10px",
            contents: [
              {
                type: "text",
                text: label,
                weight: "bold",
                size: "sm",
              },
              ...(dishName ? [{
                type: "text" as const,
                text: dishName,
                size: "xs",
                color: "#888888",
                wrap: true,
              }] : []),
            ],
          },
        ],
      },
    };

    return bubble;
  });

  const contents: FlexBubble | FlexCarousel = bubbles.length === 1 ?
    bubbles[0] :
    {type: "carousel", contents: bubbles};

  return {
    type: "flex",
    altText,
    contents,
  };
}
