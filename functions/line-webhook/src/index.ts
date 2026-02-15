import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {messagingApi, WebhookEvent, MessageEvent, PostbackEvent} from "@line/bot-sdk";
import {
  analyzeMeal,
  NotFoodError,
} from "./services";
import {
  createBear,
  generateVideo,
  getBearsForVideo,
  resetBear,
} from "./usecases";

setGlobalOptions({maxInstances: 10});

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

// LINE クライアント
const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken,
});

// LINE Blob クライアント（画像ダウンロード用）
const lineBlobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken,
});

// テスト用エンドポイント
export const hello = onRequest((request, response) => {
  logger.info("Hello endpoint called");
  response.send("Hello from Kirokuma!");
});

// LINE Webhook（メモリ・タイムアウト増量：動画生成処理のため）
export const lineWebhook = onRequest(
  {
    memory: "2GiB",
    timeoutSeconds: 540, // 9分
  },
  async (req, res) => {
    const events: WebhookEvent[] = req.body.events;

    if (!events || events.length === 0) {
      res.json({status: "ok"});
      return;
    }

    for (const event of events) {
      if (event.type === "postback") {
        await handlePostbackEvent(event as PostbackEvent);
        continue;
      }

      if (event.type !== "message") {
        continue;
      }

      const msgEvent = event as MessageEvent;

      if (msgEvent.message.type === "image") {
        await handleBearCreateEvent(msgEvent);
      } else if (msgEvent.message.type === "text") {
        const text = msgEvent.message.text;

        const userId = msgEvent.source.userId;
        if (!userId) {
          await sendGuideMessage(msgEvent.replyToken);
        } else if (text.includes("動画生成")) {
          await handleGenerateVideo(userId, msgEvent.replyToken);
        } else if (text.includes("輪廻転生")) {
          await handleResetBear(userId, msgEvent.replyToken);
        } else {
          await sendGuideMessage(msgEvent.replyToken);
        }
      }
    }

    res.json({status: "ok"});
  }
);

// ガイドメッセージを送信
async function sendGuideMessage(replyToken: string): Promise<void> {
  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "こんにちは！🐻\n食事の写真を送ってね！\n\n「動画生成」と送ると、くまの成長動画を作るよ！",
      },
    ],
  });
}

// クマ生成イベント処理
async function handleBearCreateEvent(event: MessageEvent): Promise<void> {
  const replyToken = event.replyToken;
  const userId = event.source.userId;

  logger.info("Image received", {messageId: event.message.id});

  if (!userId) {
    logger.error("userId not found in event source");
    return;
  }

  try {
    // 1. LINE から画像をダウンロード
    const imageStream = await lineBlobClient.getMessageContent(event.message.id);
    const chunks: Buffer[] = [];
    for await (const chunk of imageStream) {
      chunks.push(Buffer.from(chunk));
    }
    const imageBuffer = Buffer.concat(chunks);
    const imageBase64 = imageBuffer.toString("base64");
    logger.info("Image downloaded", {size: imageBuffer.length});

    // 2. 食事を分析して中間メッセージを送信
    const mealAnalysis = await analyzeMeal(imageBase64);
    const mainDish = mealAnalysis.dish;
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: `もぐもぐ...${mainDish}、おいしいな🐻\nどんなクマになるかな〜`,
        },
      ],
    });
    logger.info("Sent intermediate message");

    // 3. クマ生成ユースケースを実行
    const result = await createBear(imageBase64, userId);

    if (!result.success) {
      if (result.errorType === "not_food") {
        // replyTokenは使用済みなのでpushMessageで送信
        await lineClient.pushMessage({
          to: userId,
          messages: [
            {
              type: "text",
              text: "うまく食べ物を認識できなかったよ\n食べ物の写真を送ってね🐻🍽️",
            },
          ],
        });
      }
      return;
    }

    // 4. クマ画像をpushMessageで送信
    await lineClient.pushMessage({
      to: userId,
      messages: [
        {
          type: "text" as const,
          text: result.isFirstTime ?
            "くまが生まれたよ！\nこれから一緒に食事を記録していこうね！" :
            "うまうま！",
        },
        {
          type: "image" as const,
          originalContentUrl: result.bearImageUrl,
          previewImageUrl: result.bearImageUrl,
        },
      ],
    });
    logger.info("Sent bear image via pushMessage");
  } catch (error) {
    if (error instanceof NotFoodError) {
      logger.info("Not a food image, sending error message");
      await lineClient.replyMessage({
        replyToken,
        messages: [
          {
            type: "text",
            text: "うまく食べ物を認識できなかったよ\n食べ物の写真を送ってね🐻🍽️",
          },
        ],
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    logger.error("Error processing image", {message: errorMessage, stack: errorStack});
  }
}

// 動画生成処理
async function handleGenerateVideo(
  userId: string,
  replyToken: string
): Promise<void> {
  logger.info("Video generation requested", {userId});

  try {
    // クマ情報を取得してFlexMessageを先に送信
    const bearsResult = await getBearsForVideo(userId);
    if (!bearsResult.success) {
      await lineClient.replyMessage({
        replyToken,
        messages: [{type: "text", text: bearsResult.message}],
      });
      return;
    }

    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: "動画を作成中...🎬\nこれまでのクマたちを振り返ってね！",
        },
        bearsResult.flexMessage,
      ],
    });
    logger.info("Sent bear flex message while generating video");

    // 動画生成ユースケースを実行
    const result = await generateVideo(userId, bearsResult.groupId);

    if (!result.success) {
      await lineClient.pushMessage({
        to: userId,
        messages: [{type: "text", text: `ごめんね、動画生成に失敗しちゃった🐻💦\n${result.message}`}],
      });
      return;
    }

    // 動画をpushMessageで送信
    await lineClient.pushMessage({
      to: userId,
      messages: [
        {type: "text", text: "くまの成長動画ができたよ！🐻🎬"},
        {
          type: "video",
          originalContentUrl: result.videoUrl,
          previewImageUrl: result.thumbnailUrl,
        },
      ],
    });
    logger.info("Sent video via pushMessage");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    logger.error("Error generating video", {message: errorMessage, stack: errorStack});

    try {
      await lineClient.pushMessage({
        to: userId,
        messages: [{type: "text", text: `ごめんね、動画生成に失敗しちゃった🐻💦\n${errorMessage}`}],
      });
    } catch (pushError) {
      logger.error("Failed to send error message", {error: pushError});
    }
  }
}

// Postbackイベント処理
async function handlePostbackEvent(event: PostbackEvent): Promise<void> {
  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const data = event.postback.data;

  if (!userId) {
    logger.error("userId not found in postback event source");
    return;
  }

  logger.info("Postback received", {userId, data});

  const params = new URLSearchParams(data);
  const action = params.get("action");

  switch (action) {
  case "generate_video":
    await handleGenerateVideo(userId, replyToken);
    break;

  case "reset":
    await handleResetBear(userId, replyToken);
    break;

  default:
    logger.warn("Unknown postback action", {action, data});
  }
}

// リセット処理
async function handleResetBear(
  userId: string,
  replyToken: string
): Promise<void> {
  logger.info("Reset requested via postback", {userId});

  const result = await resetBear(userId);

  if (!result.success) {
    await lineClient.replyMessage({
      replyToken,
      messages: [{type: "text", text: "ごめんね、リセットに失敗しちゃった🐻💦"}],
    });
    return;
  }

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "🐻✨ 転生しました！\n\n新しい人生の始まりだよ！\nまた食事の写真を送ってね！",
      },
    ],
  });
}

