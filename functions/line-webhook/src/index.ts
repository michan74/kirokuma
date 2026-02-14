import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {messagingApi, WebhookEvent, MessageEvent, PostbackEvent} from "@line/bot-sdk";
import {
  analyzeMeal,
  generateBearImage,
  uploadImage,
  downloadImageAsBase64,
  saveBear,
  getLatestBear,
  saveMeal,
  getMealCount,
  getRecentMeals,
  generateVideoFromBears,
  reincarnate,
  getActiveGroup,
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

// LINE Webhook（メモリ・タイムアウト増量：動画生成処理のため）
export const lineWebhook = onRequest(
  {
    memory: "2GiB",
    timeoutSeconds: 540, // 9分
  },
  async (req, res) => {
    // LINE からのリクエストを検証（本番では署名検証を追加）
    const events: WebhookEvent[] = req.body.events;

    if (!events || events.length === 0) {
      res.json({status: "ok"});
      return;
    }

    // 各イベントを処理
    for (const event of events) {
      // Postbackイベントの処理
      if (event.type === "postback") {
        await handlePostbackEvent(event as PostbackEvent);
        continue;
      }

      // メッセージイベント以外は無視
      if (event.type !== "message") {
        continue;
      }

      // 型を明確にするため MessageEvent として扱う
      const msgEvent = event as MessageEvent;

      // 画像メッセージの場合
      if (msgEvent.message.type === "image") {
        await handleBearCreateEvent(msgEvent);
        continue;
      } else if (msgEvent.message.type === "text") {
        // テキストメッセージの場合
        const text = msgEvent.message.text;

        // 「動画生成」を含む場合は動画生成処理
        if (text.includes("動画生成")) {
          await handleVideoGenerationEvent(msgEvent);
          continue;
        }

        // その他のテキストは案内メッセージ
        const replyToken = msgEvent.replyToken;
        await lineClient.replyMessage({
          replyToken,
          messages: [
            {
              type: "text",
              text: "こんにちは！🐻\n食事の写真を送ってね！\n\n「動画生成」と送ると、くまの成長動画を作るよ！",
            },
          ],
        });
        continue;
      }
    }

    res.json({status: "ok"});
  }
);

// イベント処理
async function handleBearCreateEvent(event: MessageEvent): Promise<void> {
  const replyToken = event.replyToken;

  logger.info("Image received", {messageId: event.message.id});

  // ユーザーIDを取得（pushMessage用）
  const userId = event.source.userId;
  if (!userId) {
    logger.error("userId not found in event source");
    return;
  }

  try {
    // 1. 「もぐもぐ」メッセージを2秒後に返信
    // TODO: ハッカソン提出時に復活させる（無料メッセージ数制限のため一旦コメントアウト）
    // await lineClient.replyMessage({
    //   replyToken,
    //   messages: [{type: "text", text: "もぐもぐ..."}],
    // });
    // logger.info("Sent mogumogu message");

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

    // 4. 初回かどうかの判定用 & 過去7日分の食事履歴を取得
    const currentMealCount = await getMealCount(userId);
    const recentMeals = await getRecentMeals(userId);
    const pastMealAnalyses = recentMeals.map((meal) => meal.analyzedData);
    logger.info("Current meal count", {currentMealCount, pastMealsCount: pastMealAnalyses.length});

    // 5. 前のクマ画像を取得（あれば）
    let previousBearImageBase64: string | undefined;
    const latestBear = await getLatestBear(userId);
    if (latestBear) {
      previousBearImageBase64 = await downloadImageAsBase64(latestBear.imageUrl);
      logger.info("Previous bear image fetched", {bearId: latestBear.id});
    }

    // 6. 過去7日分+今回の食事履歴からくま画像を生成（差分方式）
    const allMeals = [...pastMealAnalyses, mealAnalysis];
    const bearImageBuffer = await generateBearImage(allMeals, previousBearImageBase64);
    logger.info("Bear image generated");

    // 8. くま画像をStorageにアップロード
    const timestamp = Date.now();
    const bearImageUrl = await uploadImage(
      bearImageBuffer,
      `bears/${timestamp}.png`
    );
    logger.info("Bear image uploaded", {url: bearImageUrl});

    // 9. くまをDBに保存
    const savedBear = await saveBear(bearImageUrl, userId);
    logger.info("Bear saved", {bearId: savedBear.id});

    // 10. 食事をDBに保存
    const savedMeal = await saveMeal(imageBase64, mealAnalysis, savedBear.id, userId);
    logger.info("Meal saved", {mealId: savedMeal.id});

    // 11. くま画像を pushMessage で送信（初回と2回目以降でメッセージを変える）
    const isFirstTime = currentMealCount === 0;
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

    // await lineClient.pushMessage({
    //   to: userId,
    await lineClient.replyMessage({
      replyToken,
      messages,
    });
    logger.info("Sent bear image via pushMessage");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    logger.error("Error processing image", {message: errorMessage, stack: errorStack});
    // await lineClient.pushMessage({
    //   to: userId,
    //   messages: [
    //     {
    //       type: "text",
    //       text: "ごめんね、エラーが起きちゃった🐻💦\nもう一度試してみてね！",
    //     },
    //   ],
    // });
  }
  return;
}

// 動画生成イベント処理
async function handleVideoGenerationEvent(event: MessageEvent): Promise<void> {
  const replyToken = event.replyToken;
  const userId = event.source.userId;

  if (!userId) {
    logger.error("userId not found in event source");
    return;
  }

  logger.info("Video generation requested via LINE", {userId});

  try {
    // 1. 「作成中」メッセージを返信
    // await lineClient.replyMessage({
    //   replyToken,
    //   messages: [
    //     {
    //       type: "text",
    //       text: "動画を作成中...🎬\nしばらくお待ちください！",
    //     },
    //   ],
    // });
    logger.info("Sent creating message");

    // 2. Python動画生成関数を呼び出し
    const videoGeneratorUrl = process.env.VIDEO_GENERATOR_URL ||
      "https://generate-video-python-j7lkvu6b3a-uc.a.run.app";

    logger.info("Calling video generator", {url: videoGeneratorUrl, userId});

    const response = await fetch(videoGeneratorUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({userId, imageCount: 14}),
    });

    logger.info("Video generator response", {status: response.status, ok: response.ok});

    const resultText = await response.text();
    logger.info("Video generator response body", {body: resultText.substring(0, 500)});

    let result: {videoUrl?: string; thumbnailUrl?: string; error?: string};
    try {
      result = JSON.parse(resultText);
    } catch {
      throw new Error(`Invalid JSON response: ${resultText.substring(0, 200)}`);
    }

    if (!response.ok || !result.videoUrl || !result.thumbnailUrl) {
      throw new Error(result.error || `Video generation failed (status: ${response.status})`);
    }

    logger.info("Video generated", {videoUrl: result.videoUrl, thumbnailUrl: result.thumbnailUrl});

    // 3. 動画をpushMessageで送信
    // await lineClient.pushMessage({
    // to: userId,
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: "くまの成長動画ができたよ！🐻🎬",
        },
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

    // エラーメッセージをpushMessageで送信
    try {
      await lineClient.pushMessage({
        to: userId,
        messages: [
          {
            type: "text",
            text: `ごめんね、動画生成に失敗しちゃった🐻💦\n${errorMessage}`,
          },
        ],
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

  // クエリパラメータをパース
  const params = new URLSearchParams(data);
  const action = params.get("action");

  switch (action) {
  case "generate_video":
    // 動画生成処理
    await handleVideoGenerationFromPostback(userId, replyToken);
    break;

  case "reset":
    // リセット（転生）処理
    await handleResetFromPostback(userId, replyToken);
    break;

  default:
    logger.warn("Unknown postback action", {action, data});
  }
}

// Postbackからの動画生成処理
async function handleVideoGenerationFromPostback(
  userId: string,
  replyToken: string
): Promise<void> {
  logger.info("Video generation requested via postback", {userId});

  try {
    // アクティブなグループを取得
    const activeGroup = await getActiveGroup(userId);
    if (!activeGroup) {
      await lineClient.replyMessage({
        replyToken,
        messages: [
          {
            type: "text",
            text: "まだ食事の記録がないよ🐻\nまずは食事の写真を送ってね！",
          },
        ],
      });
      return;
    }

    // Python動画生成関数を呼び出し
    const videoGeneratorUrl =
      process.env.VIDEO_GENERATOR_URL ||
      "https://generate-video-python-j7lkvu6b3a-uc.a.run.app";

    logger.info("Calling video generator", {
      url: videoGeneratorUrl,
      userId,
      groupId: activeGroup.id,
    });

    const response = await fetch(videoGeneratorUrl, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({userId, groupId: activeGroup.id, imageCount: 14}),
    });

    logger.info("Video generator response", {
      status: response.status,
      ok: response.ok,
    });

    const resultText = await response.text();
    logger.info("Video generator response body", {
      body: resultText.substring(0, 500),
    });

    let result: {videoUrl?: string; thumbnailUrl?: string; error?: string};
    try {
      result = JSON.parse(resultText);
    } catch {
      throw new Error(`Invalid JSON response: ${resultText.substring(0, 200)}`);
    }

    if (!response.ok || !result.videoUrl || !result.thumbnailUrl) {
      throw new Error(
        result.error || `Video generation failed (status: ${response.status})`
      );
    }

    logger.info("Video generated", {
      videoUrl: result.videoUrl,
      thumbnailUrl: result.thumbnailUrl,
    });

    // 動画をreplyMessageで送信
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: "くまの成長動画ができたよ！🐻🎬",
        },
        {
          type: "video",
          originalContentUrl: result.videoUrl,
          previewImageUrl: result.thumbnailUrl,
        },
      ],
    });
    logger.info("Sent video via replyMessage");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "";
    logger.error("Error generating video from postback", {
      message: errorMessage,
      stack: errorStack,
    });

    // エラーメッセージをreplyMessageで送信
    try {
      await lineClient.replyMessage({
        replyToken,
        messages: [
          {
            type: "text",
            text: `ごめんね、動画生成に失敗しちゃった🐻💦\n${errorMessage}`,
          },
        ],
      });
    } catch (replyError) {
      logger.error("Failed to send error message via reply", {error: replyError});
    }
  }
}

// Postbackからのリセット（転生）処理
async function handleResetFromPostback(
  userId: string,
  replyToken: string
): Promise<void> {
  logger.info("Reset requested via postback", {userId});

  // 転生処理: 現在のグループを終了し、新しいグループを作成
  const newGroup = await reincarnate(userId);
  logger.info("Reincarnation complete", {userId, newGroupId: newGroup.id});

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

// 動画生成エンドポイント（メモリ・タイムアウト増量）
export const generateVideo = onRequest(
  {
    memory: "2GiB",
    timeoutSeconds: 540, // 9分
    minInstances: 0,
  },
  async (req, res) => {
    try {
      const {userId} = req.body;

      if (!userId) {
        res.status(400).json({error: "userId is required"});
        return;
      }

      logger.info("Video generation requested", {userId});

      // 過去のくま画像を取得（最大14枚）
      const {default: admin} = await import("firebase-admin");
      const db = admin.firestore();
      const bearsSnapshot = await db
        .collection("bears")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(14)
        .get();

      if (bearsSnapshot.empty || bearsSnapshot.size < 2) {
        res.status(400).json({error: "At least 2 bear images are required"});
        return;
      }

      const bearImageUrls = bearsSnapshot.docs.map((doc) => doc.data().imageUrl);
      logger.info("Bear images fetched", {count: bearImageUrls.length});

      // 動画生成
      const videoUrl = await generateVideoFromBears(bearImageUrls, userId);
      logger.info("Video generated successfully", {videoUrl});

      res.json({videoUrl});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "";
      logger.error("Error generating video", {message: errorMessage, stack: errorStack});
      res.status(500).json({error: "Failed to generate video"});
    }
  }
);
