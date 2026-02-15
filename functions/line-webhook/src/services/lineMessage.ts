import {messagingApi} from "@line/bot-sdk";

type FlexMessage = messagingApi.FlexMessage;
type FlexBubble = messagingApi.FlexBubble;
type FlexCarousel = messagingApi.FlexCarousel;

/**
 * 画像 URL の配列から LINE の Flex Message（カルーセル）を構築します。
 * - 各バブルの hero に画像を表示し、タップで画像を開きます。
 * - imageUrls が 1 件の場合は単一バブルを返します。
 *
 * @param imageUrls 画像の公開 URL 配列
 * @param altText Alt テキスト（LINE の代替テキスト）
 */
export function buildBearFlexMessage(imageUrls: string[], altText = "クマ画像です"): FlexMessage {
  const maxItems = 10;
  const urls = imageUrls.slice(0, maxItems);

  const bubbles: FlexBubble[] = urls.map((url, index) => {
    const isCurrentBear = index === 0;
    const label = isCurrentBear ? "今のクマ" : "前のクマ";

    const bubble: FlexBubble = {
      type: "bubble",
      hero: {
        type: "image",
        url,
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

    // 今のクマだけシェアボタンを追加
    if (isCurrentBear) {
      bubble.footer = {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: "uri",
              label: "Xでシェア",
              uri: `https://x.com/intent/post?text=${encodeURIComponent("今日のキロクマです！")}&url=${encodeURIComponent(url)}`,
            },
          },
        ],
      };
    }

    return bubble;
  });

  const contents: FlexBubble | FlexCarousel = urls.length === 1 ?
    bubbles[0] :
    {type: "carousel", contents: bubbles};

  return {
    type: "flex",
    altText,
    contents,
  };
}
