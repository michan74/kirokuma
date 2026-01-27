import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {messagingApi, WebhookEvent} from "@line/bot-sdk";
import {
  analyzeMeal,
  generateBearImage,
  uploadImage,
  saveBear,
  saveMeal,
  getRecentMeals,
} from "./services";

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

// LINE Webhook
export const lineWebhook = onRequest(async (req, res) => {
  // LINE からのリクエストを検証（本番では署名検証を追加）
  const events: WebhookEvent[] = req.body.events;

  if (!events || events.length === 0) {
    res.json({status: "ok"});
    return;
  }

  // 各イベントを処理
  for (const event of events) {
    await handleEvent(event);
  }

  res.json({status: "ok"});
});

// イベント処理
async function handleEvent(event: WebhookEvent): Promise<void> {
  // メッセージイベント以外は無視
  if (event.type !== "message") {
    return;
  }

  const replyToken = event.replyToken;

  // 画像メッセージの場合
  if (event.message.type === "image") {
    logger.info("Image received", {messageId: event.message.id});

    // ユーザーIDを取得（pushMessage用）
    const userId = event.source.userId;
    if (!userId) {
      logger.error("userId not found in event source");
      return;
    }

    try {
      // 1. 「もぐもぐ」メッセージを即座に返信
      await lineClient.replyMessage({
        replyToken,
        messages: [{type: "text", text: "もぐもぐ..."}],
      });
      logger.info("Sent mogumogu message");

      // 2. LINE から画像をダウンロード
      const imageStream = await lineBlobClient.getMessageContent(event.message.id);
      const chunks: Buffer[] = [];
      for await (const chunk of imageStream) {
        chunks.push(Buffer.from(chunk));
      }
      const imageBuffer = Buffer.concat(chunks);
      const imageBase64 = imageBuffer.toString("base64");
      logger.info("Image downloaded", {size: imageBuffer.length});

      // 3. 食事を分析
      const mealAnalysis = await analyzeMeal(imageBase64);
      logger.info("Meal analysis result", {mealAnalysis});

      // 4. 過去7日分の食事履歴を取得
      const recentMeals = await getRecentMeals();
      const pastMealAnalyses = recentMeals.map((meal) => meal.analyzedData);
      logger.info("Past meals fetched", {count: pastMealAnalyses.length});

      // 5. 今日の食事を含めた全食事履歴でくま画像を生成
      const allMeals = [...pastMealAnalyses, mealAnalysis];
      const bearImageBuffer = await generateBearImage(allMeals);
      logger.info("Bear image generated");

      // 8. くま画像を Storage にアップロード
      const timestamp = Date.now();
      const bearImageUrl = await uploadImage(
        bearImageBuffer,
        `bears/${timestamp}.png`
      );
      logger.info("Bear image uploaded", {url: bearImageUrl});

      // 9. くまをDBに保存
      const savedBear = await saveBear(bearImageUrl);
      logger.info("Bear saved", {bearId: savedBear.id});

      // 10. 食事をDBに保存
      const savedMeal = await saveMeal(imageBase64, mealAnalysis, savedBear.id);
      logger.info("Meal saved", {mealId: savedMeal.id});

      // 11. くま画像を pushMessage で送信（初回と2回目以降でメッセージを変える）
      const isFirstTime = pastMealAnalyses.length === 0;
      const messages = isFirstTime ?
        [
          {
            type: "text" as const,
            text: "くまが生まれたよ！\nこれから一緒に食事を記録していこうね！",
          },
          {
            type: "image" as const,
            originalContentUrl: bearImageUrl,
            previewImageUrl: bearImageUrl,
          },
        ] :
        [
          {
            type: "text" as const,
            text: "うまうま！",
          },
          {
            type: "image" as const,
            originalContentUrl: bearImageUrl,
            previewImageUrl: bearImageUrl,
          },
        ];

      await lineClient.pushMessage({
        to: userId,
        messages,
      });
      logger.info("Sent bear image via pushMessage");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "";
      logger.error("Error processing image", {message: errorMessage, stack: errorStack});
      await lineClient.pushMessage({
        to: userId,
        messages: [
          {
            type: "text",
            text: "ごめんね、エラーが起きちゃった🐻💦\nもう一度試してみてね！",
          },
        ],
      });
    }
    return;
  }

  // テキストメッセージの場合
  if (event.message.type === "text") {
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: "こんにちは！🐻\n食事の写真を送ってね！",
        },
      ],
    });
    return;
  }
}
