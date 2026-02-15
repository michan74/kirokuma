/**
 * LINE リッチメニュー設定スクリプト
 *
 * 実行コマンド:
 * export $(cat functions/.env | xargs) && npx ts-node --esm scripts/setup-rich-menu.ts setup
 */

import * as fs from "fs";
import * as path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 環境変数からLINEアクセストークンを取得
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!LINE_CHANNEL_ACCESS_TOKEN) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  process.exit(1);
}

const API_BASE = "https://api.line.me/v2/bot";

// リッチメニュー設定
// サイズ: 2500x843 (コンパクト) または 2500x1686 (フル)
const RICH_MENU_CONFIG = {
  size: {
    width: 2500,
    height: 843, // コンパクトサイズ
  },
  selected: true, // デフォルトで表示
  name: "食事きろくま メニュー",
  chatBarText: "メニュー",
  areas: [
    {
      // 左: キロクスル（カメラロール）
      bounds: {
        x: 0,
        y: 0,
        width: 833,
        height: 843,
      },
      action: {
        type: "cameraRoll",
        label: "キロクスル",
      },
    },
    {
      // 中央: フリカエル（動画生成）
      bounds: {
        x: 833,
        y: 0,
        width: 834,
        height: 843,
      },
      action: {
        type: "postback",
        label: "フリカエル",
        data: "action=generate_video",
        displayText: "くまの思い出動画を作成するよ",
      },
    },
    {
      // 右: テンセイ（リセット）
      bounds: {
        x: 1667,
        y: 0,
        width: 833,
        height: 843,
      },
      action: {
        type: "postback",
        label: "テンセイ",
        data: "action=reset",
        displayText: "転生するよ",
      },
    },
  ],
};

async function createRichMenu(): Promise<string> {
  console.log("Creating rich menu...");

  const response = await fetch(`${API_BASE}/richmenu`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(RICH_MENU_CONFIG),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create rich menu: ${error}`);
  }

  const result = (await response.json()) as { richMenuId: string };
  console.log(`Rich menu created: ${result.richMenuId}`);
  return result.richMenuId;
}

async function uploadRichMenuImage(
  richMenuId: string,
  imagePath: string
): Promise<void> {
  console.log(`Uploading image for rich menu ${richMenuId}...`);

  const imageBuffer = fs.readFileSync(imagePath);

  const response = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "image/png",
      },
      body: imageBuffer,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload image: ${error}`);
  }

  console.log("Image uploaded successfully");
}

async function setDefaultRichMenu(richMenuId: string): Promise<void> {
  console.log(`Setting ${richMenuId} as default rich menu...`);

  const response = await fetch(
    `${API_BASE}/user/all/richmenu/${richMenuId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to set default rich menu: ${error}`);
  }

  console.log("Default rich menu set successfully");
}

async function listRichMenus(): Promise<void> {
  console.log("Listing existing rich menus...");

  const response = await fetch(`${API_BASE}/richmenu/list`, {
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list rich menus: ${error}`);
  }

  const result = (await response.json()) as {
    richmenus: Array<{ richMenuId: string; name: string }>;
  };
  console.log("Existing rich menus:");
  for (const menu of result.richmenus) {
    console.log(`  - ${menu.richMenuId}: ${menu.name}`);
  }
}

async function deleteRichMenu(richMenuId: string): Promise<void> {
  console.log(`Deleting rich menu ${richMenuId}...`);

  const response = await fetch(`${API_BASE}/richmenu/${richMenuId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete rich menu: ${error}`);
  }

  console.log("Rich menu deleted successfully");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "setup";

  try {
    switch (command) {
      case "list":
        await listRichMenus();
        break;

      case "delete":
        if (!args[1]) {
          console.error("Usage: setup-rich-menu.ts delete <richMenuId>");
          process.exit(1);
        }
        await deleteRichMenu(args[1]);
        break;

      case "setup":
        // 画像パスを指定（デフォルトはscripts/images/menu_2.jpg）
        const imagePath = args[1] || path.join(__dirname, "images/menu_3.png");

        if (!fs.existsSync(imagePath)) {
          console.error(`Image not found: ${imagePath}`);
          console.error("");
          console.error("Please create a rich menu image (2500x843px) at:");
          console.error(`  ${imagePath}`);
          console.error("");
          console.error("The image should have two buttons:");
          console.error("  - Left: 動画生成");
          console.error("  - Right: 使い方");
          process.exit(1);
        }

        // 1. リッチメニュー作成
        const richMenuId = await createRichMenu();

        // 2. 画像アップロード
        await uploadRichMenuImage(richMenuId, imagePath);

        // 3. デフォルトに設定
        await setDefaultRichMenu(richMenuId);

        console.log("");
        console.log("=== Setup complete! ===");
        console.log(`Rich Menu ID: ${richMenuId}`);
        break;

      default:
        console.log("Usage:");
        console.log("  setup-rich-menu.ts setup [imagePath]  - Create and set rich menu");
        console.log("  setup-rich-menu.ts list               - List existing rich menus");
        console.log("  setup-rich-menu.ts delete <id>        - Delete a rich menu");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
