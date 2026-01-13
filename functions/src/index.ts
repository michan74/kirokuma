import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {messagingApi, WebhookEvent} from "@line/bot-sdk";
import {
  analyzeMeal,
  updateBearParameters,
  generateBearImage,
  uploadImage,
  getLatestBear,
  saveBear,
  getInitialParameters,
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

      // 2. 既存のくまを取得（初回かどうかの判定）
      const existingBear = await getLatestBear();
      const isFirstTime = existingBear === null;
      logger.info("Bear check", {isFirstTime, existingBearId: existingBear?.id});

      // 3. 食事を分析
      const mealAnalysis = await analyzeMeal(imageBase64);
      logger.info("Meal analyzed", {menuName: mealAnalysis.menuName});

      // 4. 過去の食事履歴を取得
      const recentMeals = await getRecentMeals();
      logger.info("Recent meals fetched", {count: recentMeals.length});

      // 5. くまパラメータを更新（履歴も考慮）
      const existingParams = existingBear?.parameters || getInitialParameters();
      const newParams = updateBearParameters(existingParams, mealAnalysis, recentMeals);
      logger.info("Bear parameters updated", {bodyType: newParams.bodyType});

      // 6. くま画像を生成
      const bearImageBuffer = await generateBearImage(newParams);
      logger.info("Bear image generated");

      // 7. くま画像を Storage にアップロード
      const timestamp = Date.now();
      const bearImageUrl = await uploadImage(
        bearImageBuffer,
        `bears/${timestamp}.png`
      );
      logger.info("Bear image uploaded", {url: bearImageUrl});

      // 8. くまをDBに保存
      const savedBear = await saveBear(bearImageUrl, newParams);
      logger.info("Bear saved", {bearId: savedBear.id});

      // 9. 食事をDBに保存
      const savedMeal = await saveMeal(imageBase64, mealAnalysis, savedBear.id);
      logger.info("Meal saved", {mealId: savedMeal.id});

      // 10. くま画像を LINE で返信（初回と2回目以降でメッセージを変える）
      const messages = isFirstTime ?
        [
          {
            type: "text" as const,
            text: "🎉 くまが生まれたよ！\nこれから一緒に食事を記録していこうね！",
          },
          {
            type: "text" as const,
            text: `最初のごはんは${mealAnalysis.menuName}だね！🐻`,
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
            text: `${mealAnalysis.menuName}を食べたね！🐻`,
          },
          {
            type: "image" as const,
            originalContentUrl: bearImageUrl,
            previewImageUrl: bearImageUrl,
          },
        ];

      await lineClient.replyMessage({
        replyToken,
        messages,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "";
      logger.error("Error processing image", {message: errorMessage, stack: errorStack});
      await lineClient.replyMessage({
        replyToken,
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
