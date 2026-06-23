import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { product, marketAvgPrice, allPrices } = await request.json();
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ error: "未配置 AI" }, { status: 500 });

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
    });

    const prompt = `You are AI SUPER BUYER V2.0 — a world-class procurement director with 25+ years experience in international sourcing, e-commerce, fraud detection, and supply chain auditing.

Analyze this e-commerce product and return a comprehensive 10-layer due diligence report as JSON.

PRODUCT DATA:
- Name: ${product.name}
- Platform: ${product.platform}
- Price: RM ${product.price}
- Sales: ${product.sales} units sold
- Reviews: ${product.reviews} reviews
- Rating: ${product.rating}/5
- Shop Name: ${product.shopName}
- Shop Age: ${product.shopAge} months
- Market Average Price: RM ${marketAvgPrice}
- Price Range in Market: RM ${Math.min(...(allPrices || [product.price]))} - RM ${Math.max(...(allPrices || [product.price]))}

Return ONLY valid JSON (no markdown, no explanation):
{
  "layer1_authenticity": {
    "score": 0-100,
    "product_info_completeness": "assessment of name/brand/specs completeness",
    "image_risk": "low|medium|high",
    "image_notes": "brief notes on image authenticity",
    "brand_verified": true|false,
    "flags": ["flag1", "flag2"]
  },
  "layer2_pricing": {
    "score": 0-100,
    "min_price": estimated min RM,
    "avg_price": estimated avg RM,
    "max_price": estimated max RM,
    "suggested_purchase_price": RM,
    "suggested_wholesale_price": RM,
    "suggested_retail_price": RM,
    "price_competitiveness": 0-100,
    "price_assessment": "underpriced|fair|overpriced",
    "notes": "brief price analysis"
  },
  "layer3_supplier": {
    "score": 0-100,
    "shop_type": "factory|trading|unknown",
    "credibility": "assessment based on age and sales",
    "shop_age_months": ${product.shopAge},
    "red_flags": ["flag1"],
    "green_flags": ["flag1"]
  },
  "layer4_fraud_risk": {
    "risk_level": "A|B|C|D|E",
    "risk_label": "安全|较安全|一般|高风险|极高风险",
    "score": 0-100,
    "detected_patterns": ["pattern1"],
    "safe_signals": ["signal1"],
    "recommendation": "proceed|caution|avoid"
  },
  "layer5_viral_potential": {
    "score": 0-100,
    "demand_level": "high|medium|low",
    "pain_point_solved": true|false,
    "impulse_buy": true|false,
    "essential_product": true|false,
    "video_friendly": true|false,
    "viral_notes": "brief analysis"
  },
  "layer6_competition": {
    "entry_difficulty": 1-5,
    "market_saturation": "low|medium|high",
    "price_war_risk": "low|medium|high",
    "competitor_count_estimate": "few|moderate|many",
    "notes": "brief competition analysis"
  },
  "layer7_profit": {
    "estimated_purchase_cost": RM,
    "estimated_logistics": RM,
    "platform_commission_pct": percent,
    "estimated_gross_margin_pct": percent,
    "estimated_net_margin_pct": percent,
    "estimated_roi_pct": percent,
    "payback_months": number,
    "profit_assessment": "excellent|good|fair|poor"
  },
  "layer8_oem_odm": {
    "score": 0-100,
    "white_label_suitable": true|false,
    "private_label_suitable": true|false,
    "brand_potential": "high|medium|low",
    "notes": "brief OEM/ODM analysis"
  },
  "layer9_trend": {
    "3_months": "rising|stable|declining",
    "6_months": "rising|stable|declining",
    "12_months": "rising|stable|declining",
    "trend_notes": "brief trend analysis",
    "seasonality": "seasonal|evergreen"
  },
  "layer10_decision": {
    "total_score": 0-100,
    "grade": "S|A|B|C|D|E",
    "grade_label": "立即采购|推荐采购|小批量测试|观察|高风险|放弃",
    "action": "buy_large|buy_recommended|buy_small|watch|avoid|reject",
    "summary": "2-3 sentence executive summary in Chinese",
    "top_risks": ["risk1", "risk2"],
    "top_opportunities": ["opp1", "opp2"],
    "scores": {
      "product_authenticity": 0-100,
      "market_price": 0-100,
      "supplier_trust": 0-100,
      "fraud_risk": 0-100,
      "profit_potential": 0-100,
      "viral_potential": 0-100,
      "brand_potential": 0-100,
      "trend_score": 0-100
    }
  }
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown fences and parse JSON
    const cleaned = text.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
    let analysis = null;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try { analysis = JSON.parse(m[0]); } catch {}
      }
    }

    if (!analysis) {
      console.error("[super-analyze] JSON parse failed. Raw text:", text.slice(0, 500));
      return NextResponse.json({ error: "AI 分析失败，请重试" }, { status: 500 });
    }

    return NextResponse.json({ analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[super-analyze] fatal:", msg);
    return NextResponse.json({ error: `分析失败: ${msg.slice(0, 120)}` }, { status: 500 });
  }
}
