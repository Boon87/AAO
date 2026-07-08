import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// Mine improvement opportunities for a bestseller: what buyers complain about and
// how to make a better version. Grounds on real pasted reviews when given; otherwise
// reasons from category experience (clearly flagged as such, not invented reviews).
export async function POST(request: NextRequest) {
  try {
    const { productName, reviews } = await request.json();
    if (!productName || !String(productName).trim()) {
      return NextResponse.json({ error: "缺少产品名称" }, { status: 400 });
    }

    const hasReviews = typeof reviews === "string" && reviews.trim().length > 0;
    const reviewBlock = hasReviews
      ? `以下是这个产品的真实买家评价（可能含好评和差评）：\n"""\n${String(reviews).slice(0, 6000)}\n"""\n请**只根据这些评价**总结抱怨点。`
      : `没有提供真实评价。请**根据这个品类的常见痛点经验**推断买家最可能抱怨的问题（在 source 字段标注 "category"）。`;

    const prompt = `你是电商选品与产品改良顾问。商家想进口/生产一个比爆款更好的版本。

产品：${productName}
${reviewBlock}

返回 JSON（只返回 JSON，不要解释、不要 markdown）：
{
  "source": "reviews" 或 "category",
  "complaints": [
    { "issue": "抱怨点（简短中文）", "detail": "具体说明", "severity": "高/中/低" }
  ],
  "improvements": ["针对抱怨的具体改良建议（中文，可执行）"],
  "sellingPoints": ["改良后可以主打的卖点（中文，一句话）"],
  "summary": "一句话总结这个品的改良机会"
}
规则：complaints 3-6 条，按 severity 由高到低；improvements 与 complaints 对应；不要编造评价内容；如果是 category 推断，措辞用"通常/常见"。`;

    let text = "";
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2000, temperature: 0.3 } }),
        });
        if (res.ok) {
          const json = await res.json();
          text = (json.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        }
      } catch {
        /* fall through to Claude */
      }
    }

    if (!text) {
      const claudeKey = process.env.ANTHROPIC_API_KEY;
      if (!claudeKey) return NextResponse.json({ error: "AI 服务暂时不可用（未配置密钥）" }, { status: 503 });
      try {
        const client = new Anthropic({ apiKey: claudeKey });
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        });
        text = (msg.content[0] as { text: string }).text.trim();
      } catch (e) {
        return NextResponse.json({ error: `AI 错误：${(e instanceof Error ? e.message : String(e)).slice(0, 120)}` }, { status: 500 });
      }
    }

    const cleaned = text.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
    let analysis = null;
    try { analysis = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { analysis = JSON.parse(m[0]); } catch { /* ignore */ } }
    }
    if (!analysis) return NextResponse.json({ error: "AI 返回格式异常，请重试" }, { status: 502 });

    return NextResponse.json({ analysis, grounded: hasReviews });
  } catch (error) {
    console.error("mine-reviews failed:", error);
    return NextResponse.json({ error: "分析服务暂时不可用" }, { status: 500 });
  }
}
