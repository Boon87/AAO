import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

    const systemPrompt =
      "You are a product identification assistant for an e-commerce price comparison tool (Shopee/Lazada Malaysia).\n\nRules:\n1. If the product has a visible English brand name or model number (e.g. Sony WH-1000XM5, Philips Airfryer, IKEA KALLAX), return the brand + product name in English — exactly as it appears, e.g. \"Sony WH-1000XM5\" or \"Philips HD9252\"\n2. If the product is a generic item with no clear brand, return a SPECIFIC Chinese search term (3-8 characters) that describes the exact product type — NOT the general category.\n   - Bad: 剪刀, 杯子, 锅 (too generic)\n   - Good: 多层葱花剪, 不锈钢保温杯, 铸铁煎锅 (specific type)\n   - Include key distinguishing features: material (不锈钢/硅胶/竹制), function (多层/折叠/便携), shape (圆形/方形) when clearly visible\n3. Be SPECIFIC — include model numbers, blade count, material, or other distinguishing features when visible\n4. Return ONLY the search keyword, nothing else. No punctuation, no explanation.";

    let productName = "";

    // Try Gemini first (free), fall back to Claude if Gemini fails
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent([
          systemPrompt + "\n\nWhat product is this? Return only the search keyword.",
          { inlineData: { mimeType: mimeType as string, data: imageBase64 } },
        ]);
        productName = result.response.text().trim();
      } catch {
        // Gemini failed, fall through to Claude
      }
    }

    // Fall back to Claude if Gemini didn't return a result
    if (!productName && apiKey) {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 50,
        system: systemPrompt,
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
              { type: "text", text: "What product is this? Return only the search keyword." },
            ],
          },
        ],
      });
      productName = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    }

    if (!productName) {
      return NextResponse.json({ error: "无法识别产品" }, { status: 422 });
    }

    return NextResponse.json({ productName });
  } catch (error) {
    console.error("识别失败:", error);
    return NextResponse.json({ error: "识别服务暂时不可用" }, { status: 500 });
  }
}
