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

Analyze the product in the image carefully and return a JSON object. Be precise — especially about MATERIAL.

MATERIAL IDENTIFICATION GUIDE (look carefully):
- Stainless steel (不锈钢): metallic silver rim/base/bottom visible, shiny or powder-coated metal surface, often double-walled, feels heavy
- Ceramic (陶瓷): matte or glazed finish, thick walls, no metallic parts, chip-prone edges
- Glass (玻璃): transparent or tinted, see-through
- Plastic (塑料): lightweight look, seams visible, matte or glossy non-metallic finish
- Silicone (硅胶): flexible-looking, rubbery texture

Look at the RIM, BOTTOM, and HANDLE closely to identify the true material.

Return ONLY valid JSON, no other text:
{
  "searchKeyword": "best Shopee/Lazada search term — color + material + product type (NO decorative logos/restaurant names) e.g. 红色不锈钢保温马克杯",
  "productName": "full specific product name in Chinese",
  "color": {
    "main": "color name in Chinese",
    "hex": "#XXXXXX (best estimate)",
    "surface": "surface finish e.g. 粉末喷涂哑光/亮面/磨砂/烤漆"
  },
  "capacity": "estimated capacity with unit based on visual size comparison, or null",
  "dimensions": "estimated H×D in cm based on visual scale, or null",
  "material": {
    "main": "primary material — be precise: 304不锈钢/316不锈钢/陶瓷/玻璃/硅胶/PP塑料",
    "details": "e.g. 外层304不锈钢粉末喷涂, 内胆316不锈钢, 杯盖PP+硅胶密封圈"
  },
  "brand": {
    "text": "any text/logo on product, or null",
    "type": "manufacturer (Sony/Philips/etc) OR decorative (restaurant/team/event/custom print)",
    "position": "location on product e.g. 正面中央"
  },
  "features": ["specific feature 1", "specific feature 2"],
  "quality": "X.X/10 — brief reason based on visible build quality",
  "market": "市场定位 e.g. 中高端礼品保温杯/日常家用/专业用途",
  "confidence": "XX% — overall identification confidence"
}

SEARCH KEYWORD RULES — CRITICAL:
The searchKeyword must ONLY contain product descriptor words. Ask yourself: "Does this word describe WHAT the product IS, or does it describe WHO it belongs to / WHOSE logo is on it?"

ALLOWED in searchKeyword: color (红色), material (不锈钢), product type (保温马克杯), product features (双层/带手柄), manufacturer brand + model (Sony WH-1000XM5)
FORBIDDEN in searchKeyword: restaurant names, café names, bar names, team names, athlete names, celebrity names, place names, event names, university names, company names printed AS LOGOS

TEST: Could a factory produce this product WITHOUT the logo and it would still be the same product type? If YES → the name is decorative → exclude from searchKeyword.

EXAMPLES:
- Red stainless mug with "The Kobe Japanese Restaurant" logo → brand.type=decorative → searchKeyword: "红色不锈钢双层保温马克杯带手柄" (NO "Kobe")
- Black mouse with "Yesido" engraved → brand.type=manufacturer → searchKeyword: "Yesido 黑色有线RGB游戏鼠标"
- White mug with "Starbucks" → brand.type=decorative (Starbucks doesn't manufacture mugs) → searchKeyword: "白色陶瓷马克杯"
- Sony WH-1000XM5 headphones → brand.type=manufacturer → searchKeyword: "Sony WH-1000XM5"
- Be specific: 真空双层不锈钢保温马克杯 not just 杯子`;

    let productName = "";

    // Try Gemini first (free), fall back to Claude if Gemini fails
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
