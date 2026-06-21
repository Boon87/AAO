import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const MOCK_PRODUCTS = ["竹砧板", "不锈钢汤锅", "桌面收纳盒", "浴室置物架", "硅胶烘焙垫"];

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType } = await request.json();

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: "缺少图片数据" }, { status: 400 });
    }

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(mimeType)) {
      return NextResponse.json({ error: "不支持的图片格式" }, { status: 400 });
    }

    // Demo mode: return mock result when API key is not configured
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === "your_api_key_here") {
      await new Promise((r) => setTimeout(r, 1500)); // simulate delay
      // 25% chance of "unrecognized" so both states can be previewed
      if (Math.random() < 0.25) {
        return NextResponse.json({ error: "无法识别产品" }, { status: 422 });
      }
      const mockName = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
      return NextResponse.json({ productName: mockName, demo: true });
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      system:
        "你是产品识别助手。看图后只返回 2–6 个字的中文产品名，适合在 Shopee/Lazada 搜索用。例：竹砧板、不锈钢汤锅、桌面收纳盒。只返回产品名，不要任何解释或标点。",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "这是什么产品？",
            },
          ],
        },
      ],
    });

    const productName =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";

    if (!productName) {
      return NextResponse.json({ error: "无法识别产品" }, { status: 422 });
    }

    return NextResponse.json({ productName });
  } catch (error) {
    console.error("识别失败:", error);
    return NextResponse.json({ error: "识别服务暂时不可用" }, { status: 500 });
  }
}
