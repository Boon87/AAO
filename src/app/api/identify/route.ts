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
Ask yourself ONE question: "If I search this brand/name on Shopee or Lazada, will I find THIS type of product for sale?"

INCLUDE brand name in searchKeyword if:
→ It's the product's manufacturer (Sony, Philips, Yesido, IKEA, Nike, Adidas)
→ It's a famous brand whose products are sold on Shopee/Lazada (Starbucks mug, Arsenal jersey, Hello Kitty case, Disney item, NBA team merchandise)
→ Searching the brand name on Shopee would return the same/similar product

EXCLUDE brand name from searchKeyword if:
→ It's a local restaurant, local café, local bar, local business (their custom merchandise is NOT sold on Shopee)
→ It's a company's corporate gift / promotional item (not for public sale)
→ Searching that name on Shopee would return WRONG or UNRELATED products

EXAMPLES:
✓ Sony WH-1000XM5 headphones → searchKeyword: "Sony WH-1000XM5" (Sony sells on Shopee)
✓ Starbucks city mug → searchKeyword: "Starbucks城市马克杯" (Starbucks mugs sold on Shopee)
✓ Arsenal FC jersey → searchKeyword: "Arsenal足球衣" (team jerseys sold on Shopee)
✓ Hello Kitty backpack → searchKeyword: "Hello Kitty双肩包" (licensed products on Shopee)
✗ "The Kobe Japanese Restaurant" mug → searchKeyword: "红色不锈钢双层保温马克杯带手柄" (local restaurant gift, not on Shopee)
✗ Company X corporate gift mug → searchKeyword: "不锈钢企业礼品保温杯" (custom corporate item)
- Be specific: 真空双层不锈钢保温马克杯 not just 杯子

FUNCTION DIFFERENTIATION — CRITICAL for mechanical/electrical products:
You MUST include the POWER/MECHANISM type in the keyword so that completely different products are NOT mixed together:
- Electric motor cup → "电动搅拌杯充电" NOT just "搅拌杯" (magnetic stirrers are totally different)
- Protein shaker with motor → "全自动电动摇摇杯蛋白粉"
- Self-heating mug → "自加热保温杯USB"
- Magnetic stirrer → "磁力搅拌马克杯"
- Manual grinder → "手摇咖啡磨豆机" NOT "咖啡机"
- Electric blender → "便携式电动搅拌机充电" NOT "搅拌机"

PRICE-RANGE AWARENESS:
If the product looks like a premium/mid-range item (visible brand, quality materials, complex mechanism), the keyword should reflect that — add qualifiers like "充电款" "USB" "电动" "自动" "高端" that distinguish it from cheap alternatives.`;

    let productName = "";

    // Try Taobao image search first — most accurate for Chinese products
    try {
      const tbResult = await searchTaobaoImage(imageBase64, mimeType as string);
      if (tbResult) {
        productName = tbResult;
      }
    } catch {
      // Taobao failed, fall through
    }

    // Try Gemini second (free), fall back to Claude if Gemini fails
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!productName && geminiKey) {
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

    // Parse JSON analysis — handle markdown fences, extra text, etc.
    const parseAnalysis = (raw: string) => {
      // Strip markdown code fences: ```json ... ``` or ``` ... ```
      const stripped = raw.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
      // Try direct parse
      try { return JSON.parse(stripped); } catch {}
      // Try extract first {...} block
      const m = stripped.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch {} }
      return null;
    };

    const analysis = parseAnalysis(productName);
    if (analysis?.searchKeyword || analysis?.productName) {
      return NextResponse.json({
        productName: analysis.searchKeyword || analysis.productName,
        analysis,
      });
    }

    // If productName looks like raw JSON or garbage, return error
    if (productName.includes('"searchKeyword"') || productName.startsWith("{")) {
      return NextResponse.json({ error: "无法识别产品" }, { status: 422 });
    }

    return NextResponse.json({ productName });
  } catch (error) {
    console.error("识别失败:", error);
    return NextResponse.json({ error: "识别服务暂时不可用" }, { status: 500 });
  }
}

// Search Taobao image search (拍立淘) and return the top product keyword
async function searchTaobaoImage(imageBase64: string, mimeType: string): Promise<string | null> {
  const buffer = Buffer.from(imageBase64, "base64");
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/gif" ? "gif" : "jpg";
  const boundary = "----FormBoundary" + Math.random().toString(36).slice(2, 18);

  // Build multipart body manually
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="imgfile"; filename="image.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await fetch(
    "https://s.taobao.com/search?imgfile=&js=1&newwindow=1&initiative_id=staobaoz_20200129&ie=utf8",
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://s.taobao.com/",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      body,
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!res.ok) return null;
  const html = await res.text();

  // Extract product titles from embedded page data
  const titles: string[] = [];

  // Method 1: g_page_config JSON blob
  const cfgMatch = html.match(/g_page_config\s*=\s*(\{[\s\S]*?\})\s*;?\s*\n/);
  if (cfgMatch) {
    try {
      const cfg = JSON.parse(cfgMatch[1]);
      const auctions: { raw_title?: string; title?: string }[] =
        cfg?.mods?.itemlist?.data?.auctions || [];
      for (const a of auctions.slice(0, 6)) {
        const t = a.raw_title || a.title || "";
        if (t) titles.push(t);
      }
    } catch {}
  }

  // Method 2: scan raw_title fields in JSON fragments
  if (titles.length === 0) {
    const rx = /"raw_title"\s*:\s*"([^"]{4,60})"/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(html)) !== null && titles.length < 6) {
      titles.push(m[1]);
    }
  }

  if (titles.length === 0) return null;

  // Pick the shortest title (most likely to be a clean product name, not a long promotional title)
  const best = titles.reduce((a, b) => (a.length <= b.length ? a : b));

  // Strip common junk: 【...】 brackets, promotional phrases
  const cleaned = best
    .replace(/【[^】]{0,20}】/g, "")
    .replace(/[！!|｜]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);

  return cleaned || null;
}
