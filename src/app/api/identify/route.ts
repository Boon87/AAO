import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const MOCK_PRODUCTS = ["竹砧板", "不锈钢汤锅", "桌面收纳盒", "浴室置物架", "硅胶烘焙垫"];

// This route is the AI BACKUP for photo identification. The primary path is
// Taobao 拍立淘 (run in the browser by the extension). Only when 拍立淘 can't
// identify the product does the modal fall back here. Because AI vision is less
// reliable, the prompt is tuned for CAUTION: identify only the main product,
// stay generic when unsure, never invent brands, and report honest confidence.
// The modal then shows the result on a confirm screen (never auto-searches it).
const systemPrompt = `You are a product identification assistant for a Malaysian e-commerce price-comparison tool. A shopper uploaded ONE photo. Name the MAIN product precisely enough that searching your keyword on Shopee / Lazada / Taobao returns the SAME kind of product.

Return ONLY a JSON object — no markdown, no code fences, no extra text:
{
  "searchKeyword": "the Chinese term a shopper would type to find this exact product",
  "productName": "short Chinese product name",
  "category": "broad Chinese category, e.g. 水杯 / 厨房用品 / 收纳 / 数码配件",
  "confidence": <integer 0-100>,
  "reason": "one short Chinese phrase describing what you actually see"
}

RULES — follow strictly. ACCURACY beats specificity:
1. Identify ONLY the single main product in the foreground. Ignore hands, background, table, packaging, props, and any other items.
2. Build the keyword as 品类 first, then add 材质/颜色/形状/关键功能 ONLY if clearly visible. e.g. 双层玻璃保温杯, 竹制切菜板, 桌面文具收纳盒.
3. Prefer GENERIC when unsure. A correct broad keyword (保温杯) beats a wrong specific guess (星巴克樱花限定马克杯). Never add a detail you are not confident about.
4. NEVER invent a brand, model number, or series name. Include a brand ONLY if its logo/text is clearly legible AND it is a real manufacturer sold online (Sony, Philips, IKEA…). When in doubt, leave the brand out entirely.
5. For powered / mechanical items, include the mechanism (电动 / 充电 / 手动 / 磁力) so unrelated products don't get mixed together.
6. confidence = how sure you are the keyword finds THIS product. Be honest: blurry, dim, cropped, or multi-item photos → confidence below 50. Only give 80+ when the product is unmistakable.
7. Keep searchKeyword under 20 Chinese characters. No punctuation, no restaurant / café / company names, no decorative print text.`;

interface IdentifyAnalysis {
  searchKeyword?: string;
  productName?: string;
  category?: string;
  confidence?: string | number;
  reason?: string;
}

function parseAnalysis(raw: string): IdentifyAnalysis | null {
  // Strip markdown code fences, then try to parse the JSON object.
  const stripped = raw.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(stripped) as IdentifyAnalysis;
  } catch {
    // ignore and try to extract the first {...} block
  }
  const m = stripped.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]) as IdentifyAnalysis;
    } catch {
      // ignore
    }
  }
  return null;
}

// Normalize confidence to an "NN%" string for display.
function fmtConfidence(c: string | number | undefined): string | undefined {
  if (c === undefined || c === null) return undefined;
  if (typeof c === "number") return `${Math.round(c)}%`;
  const s = String(c).trim();
  if (/^\d+$/.test(s)) return `${s}%`;
  return s;
}

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const hasClaude = !!apiKey && apiKey !== "your_api_key_here";

    // Demo mode: no AI keys configured → return a mock result so the UI still works.
    if (!hasClaude && !geminiKey) {
      await new Promise((r) => setTimeout(r, 1200));
      if (Math.random() < 0.25) {
        return NextResponse.json({ error: "无法识别产品" }, { status: 422 });
      }
      const mockName = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
      return NextResponse.json({
        productName: mockName,
        analysis: { searchKeyword: mockName, productName: mockName, category: "示例", confidence: "70%", reason: "演示模式（未配置 AI 密钥）" },
        source: "ai",
        demo: true,
      });
    }

    let raw = "";

    // Gemini first (free tier), then fall back to Claude.
    if (geminiKey) {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([
          systemPrompt + "\n\nIdentify the main product. Return only the JSON object.",
          { inlineData: { mimeType: mimeType as string, data: imageBase64 } },
        ]);
        raw = result.response.text().trim();
      } catch {
        // Gemini failed → fall through to Claude
      }
    }

    if (!raw && hasClaude) {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
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
              { type: "text", text: "Identify the main product. Return only the JSON object." },
            ],
          },
        ],
      });
      raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    }

    if (!raw) {
      return NextResponse.json({ error: "无法识别产品" }, { status: 422 });
    }

    const analysis = parseAnalysis(raw);
    const keyword = (analysis?.searchKeyword || analysis?.productName || "").trim();
    if (!keyword) {
      return NextResponse.json({ error: "无法识别产品" }, { status: 422 });
    }

    return NextResponse.json({
      productName: keyword,
      analysis: { ...analysis, searchKeyword: keyword, confidence: fmtConfidence(analysis?.confidence) },
      source: "ai",
    });
  } catch (error) {
    console.error("识别失败:", error);
    return NextResponse.json({ error: "识别服务暂时不可用" }, { status: 500 });
  }
}
