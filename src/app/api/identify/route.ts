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

    const systemPrompt = `You are a professional product analyst for an e-commerce price comparison tool (Shopee/Lazada Malaysia).

Analyze the product in the image and return a JSON object. Be as detailed as possible based on what is visible.

Return ONLY valid JSON, no other text:
{
  "searchKeyword": "best search term for Shopee/Lazada (mix Chinese+English, 5-12 chars, include color+material+type+brand if manufacturer)",
  "productName": "full specific product name in Chinese",
  "color": {
    "main": "color name in Chinese",
    "hex": "#XXXXXX (best estimate)",
    "surface": "surface finish e.g. 粉末喷涂哑光/亮面/磨砂"
  },
  "capacity": "estimated capacity with unit, or null if not applicable",
  "dimensions": "estimated dimensions H×D or L×W×H in cm, or null",
  "material": {
    "main": "main material",
    "details": "additional material details e.g. inner/outer/lid"
  },
  "brand": {
    "text": "any brand or logo text visible on product, or null",
    "type": "manufacturer OR decorative",
    "position": "where on product"
  },
  "features": ["feature1", "feature2", "feature3"],
  "quality": "X.X/10 with brief reason",
  "market": "market positioning e.g. 中高端礼品/日常家用/专业用途",
  "confidence": "overall confidence 0-100%"
}

Search keyword rules:
- Manufacturer brand (Sony, Yesido, Philips) → include brand + model in English
- Decorative logo (restaurant, team, event) → use color + material + product type, optionally add logo text
- Always specific: 不锈钢保温马克杯 not just 杯子`;

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

    // Try to parse as JSON analysis
    try {
      const jsonMatch = productName.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          productName: analysis.searchKeyword || analysis.productName,
          analysis,
        });
      }
    } catch {}

    return NextResponse.json({ productName });
  } catch (error) {
    console.error("识别失败:", error);
    return NextResponse.json({ error: "识别服务暂时不可用" }, { status: 500 });
  }
}
