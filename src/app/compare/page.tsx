"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Star, ShoppingBag, MessageSquare, Heart, Sparkles,
  TrendingUp, Info, CheckCircle, AlertTriangle, ExternalLink,
} from "lucide-react";
import { clsx } from "clsx";
import { Navbar } from "@/components/navbar";
import { AuthenticityBadge } from "@/components/authenticity-badge";
import { SuperAnalysisModal } from "@/components/super-analysis-modal";
import { PLATFORM_LABELS, PLATFORM_COLORS, type Product } from "@/lib/mock-data";
import { useLanguage } from "@/lib/i18n";

function CompareContent() {
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = searchParams.get("ids")?.split(",") || [];
  const [analyzeProduct, setAnalyzeProduct] = useState<Product | null>(null);

  let products: Product[] = [];
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("aao_compare_products");
      if (stored) {
        const all: Product[] = JSON.parse(stored);
        products = all.filter((p) => ids.includes(p.id));
      }
    } catch {}
  }

  if (products.length < 2) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-slate-500">{t("cmp_no_products")}</p>
          <button onClick={() => router.back()} className="text-blue-600 hover:underline text-sm">
            {t("cmp_go_results")}
          </button>
        </div>
      </div>
    );
  }

  const prices = products.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const maxSales = Math.max(...products.map((p) => p.sales));

  // Merchant pricing basis: cost = cheapest China-sourcing product among the selected;
  // MY market range = min/max of the Malaysian-marketplace products among the selected.
  const sourcingProducts = products.filter((p) => p.platform === "taobao" || p.platform === "1688" || p.platform === "pinduoduo");
  const cost = sourcingProducts.length ? Math.min(...sourcingProducts.map((p) => p.price)) : 0;
  const myProducts = products.filter((p) => p.platform === "shopee" || p.platform === "lazada");
  const myMin = myProducts.length ? Math.min(...myProducts.map((p) => p.price)) : 0;
  const myMax = myProducts.length ? Math.max(...myProducts.map((p) => p.price)) : 0;

  const colWidth = Math.floor(100 / products.length);

  const rows: { label: string; render: (p: Product) => React.ReactNode }[] = [
    {
      label: t("cmp_attr_price"),
      render: (p) => (
        <div className="flex flex-col gap-1">
          <span className={clsx("text-2xl font-bold", p.price === minPrice ? "text-green-600" : "text-slate-900")}>
            RM {p.price.toFixed(2)}
          </span>
          {p.price === minPrice && products.length > 1 && (
            <span className="inline-flex w-fit text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
              {lang === "zh" ? "最低价 ✓" : "Lowest ✓"}
            </span>
          )}
          {p.price === maxPrice && products.length > 1 && p.price !== minPrice && (
            <span className="inline-flex w-fit text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
              {lang === "zh" ? "最高价" : "Highest"}
            </span>
          )}
        </div>
      ),
    },
    {
      label: t("cmp_attr_sales"),
      render: (p) => (
        <div className="flex flex-col gap-1">
          <span className={clsx("flex items-center gap-1.5 text-base font-semibold", p.sales === maxSales && p.sales > 0 ? "text-blue-600" : "text-slate-700")}>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
            {p.sales > 0 ? p.sales.toLocaleString() : "—"}
          </span>
          {p.sales === maxSales && p.sales > 0 && (
            <span className="inline-flex w-fit text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
              {lang === "zh" ? "销量最高" : "Top Sales"}
            </span>
          )}
        </div>
      ),
    },
    {
      label: t("cmp_attr_reviews"),
      render: (p) => (
        <span className="flex items-center gap-1.5 text-base text-slate-700">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          {p.reviews > 0 ? p.reviews.toLocaleString() : "—"}
        </span>
      ),
    },
    {
      label: lang === "zh" ? "收藏" : "Favorites",
      render: (p) => {
        const likes = p.likes ?? 0;
        const topLikes = Math.max(...products.map((x) => x.likes ?? 0));
        return (
          <div className="flex flex-col gap-1">
            <span className={clsx("flex items-center gap-1.5 text-base font-semibold", likes === topLikes && likes > 0 ? "text-pink-600" : "text-slate-700")}>
              <Heart className="w-4 h-4 text-slate-400" />
              {likes > 0 ? likes.toLocaleString() : "—"}
            </span>
            {likes === topLikes && likes > 0 && (
              <span className="inline-flex w-fit text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-semibold">
                {lang === "zh" ? "最受欢迎" : "Most Wanted"}
              </span>
            )}
          </div>
        );
      },
    },
    {
      label: t("cmp_attr_rating"),
      render: (p) => (
        <span className="flex items-center gap-1.5 text-base text-slate-700">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          {p.rating > 0 ? `${p.rating.toFixed(1)} / 5.0` : "—"}
        </span>
      ),
    },
    {
      label: t("cmp_attr_shop"),
      render: (p) => (
        <div className="text-sm text-slate-700">
          <p className="font-medium">{p.shopName}</p>
          {p.shopAge > 0 && (
            <p className="text-slate-400 text-xs mt-0.5">
              {lang === "zh" ? `店龄 ${p.shopAge} 个月` : `${p.shopAge} months old`}
            </p>
          )}
        </div>
      ),
    },
    {
      label: t("cmp_attr_authenticity"),
      render: (p) =>
        // No sales/reviews/favorites/rating → nothing to verify; a "100 分"
        // there would be misleading. Say so instead of pretending certainty.
        p.sales === 0 && p.reviews === 0 && (p.likes ?? 0) === 0 && p.rating === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
            {lang === "zh" ? "数据不足 · 未评估" : "No data · not scored"}
          </span>
        ) : (
          <AuthenticityBadge score={p.authenticityScore} level={p.authenticityLevel} />
        ),
    },
    {
      label: t("cmp_suspicious_flags"),
      render: (p) =>
        p.authenticityFlags.length === 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle className="w-3.5 h-3.5" /> {t("cmp_no_flags")}
          </div>
        ) : (
          <ul className="space-y-1">
            {p.authenticityFlags.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {f}
              </li>
            ))}
          </ul>
        ),
    },
    {
      label: t("cmp_attr_link"),
      render: (p) =>
        p.url ? (
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            {t("cmp_visit")} {PLATFORM_LABELS[p.platform]} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("cmp_back")}
          </button>
          <span className="text-slate-300">/</span>
          <h1 className="text-lg font-bold text-slate-800">
            {t("cmp_title")} ({products.length})
          </h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Comparison table ── */}
          <div className="flex-1 min-w-0 overflow-x-auto">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full border-collapse">
                <colgroup>
                  <col style={{ width: "130px" }} />
                  {products.map((p) => (
                    <col key={p.id} style={{ width: `${colWidth}%` }} />
                  ))}
                </colgroup>

                {/* Product header row */}
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      {lang === "zh" ? "产品" : "Product"}
                    </th>
                    {products.map((p) => (
                      <th key={p.id} className="px-4 py-4 text-left border-l border-slate-100">
                        <div className="flex flex-col gap-2">
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-28 object-cover rounded-xl bg-slate-100"
                          />
                          <span className={clsx("inline-flex w-fit text-xs font-semibold px-2 py-0.5 rounded-full", PLATFORM_COLORS[p.platform])}>
                            {PLATFORM_LABELS[p.platform]}
                          </span>
                          <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-3">
                            {p.name}
                          </p>
                          <button
                            onClick={() => setAnalyzeProduct(p)}
                            className="mt-1 inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {lang === "zh" ? "AI 深度分析" : "AI Deep Analysis"}
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Data rows */}
                <tbody>
                  {rows.map((row, idx) => (
                    <tr
                      key={row.label}
                      className={clsx("border-b border-slate-100 last:border-0", idx % 2 === 0 ? "bg-white" : "bg-slate-50/50")}
                    >
                      <td className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide align-top whitespace-nowrap bg-slate-50 border-r border-slate-100">
                        {row.label}
                      </td>
                      {products.map((p) => (
                        <td key={p.id} className="px-4 py-4 align-top border-l border-slate-100">
                          {row.render(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Analysis panel ── */}
          <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">

            {/* Price analysis */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-slate-800">{lang === "zh" ? "价格分析" : "Price Analysis"}</h2>
              </div>
              <div className="space-y-3">
                {[
                  { label: lang === "zh" ? "均价" : "Avg", value: `RM ${avgPrice.toFixed(2)}`, color: "text-slate-800" },
                  { label: lang === "zh" ? "最低价" : "Lowest", value: `RM ${minPrice.toFixed(2)}`, color: "text-green-600" },
                  { label: lang === "zh" ? "最高价" : "Highest", value: `RM ${maxPrice.toFixed(2)}`, color: "text-red-600" },
                  { label: lang === "zh" ? "价差" : "Spread", value: `RM ${(maxPrice - minPrice).toFixed(2)}`, color: "text-amber-600" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">{item.label}</span>
                    <span className={clsx("text-sm font-bold", item.color)}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing recommendation — cost + margin when a sourcing product is selected */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold text-slate-800">{lang === "zh" ? "定价建议" : "Pricing Guide"}</h2>
              </div>
              {cost > 0 ? (
                <>
                  <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100">
                    <span className="text-xs text-slate-500">{lang === "zh" ? "进货成本（最低）" : "Cost (cheapest source)"}</span>
                    <span className="text-sm font-bold text-slate-800">RM {cost.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    {lang === "zh" ? "以进货成本为基准的建议售价（含利润）：" : "Suggested selling price (cost + margin):"}
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { tier: lang === "zh" ? "稳健" : "Safe", m: 2, color: "bg-green-50 border-green-200 text-green-800" },
                      { tier: lang === "zh" ? "标准" : "Standard", m: 2.5, color: "bg-blue-50 border-blue-200 text-blue-800" },
                      { tier: lang === "zh" ? "高利润" : "High-margin", m: 3, color: "bg-purple-50 border-purple-200 text-purple-800" },
                    ].map((rec) => {
                      const sell = cost * rec.m;
                      const profit = sell - cost;
                      const marginPct = Math.round((profit / sell) * 100);
                      // Reality-check each tier against actual MY market prices. Two
                      // ways a tier is unrealistic: (a) the cheapest competitor already
                      // sells at/below your cost (you can't win on price at all), or
                      // (b) this tier's price is above the whole market. Both must flag,
                      // so the tiers never say "✓ within range" while the verdict says
                      // "source doesn't work".
                      const belowMarketFloor = myMin > 0 && myMin < cost;
                      const aboveMarket = myMax > 0 && sell > myMax;
                      const tierBad = belowMarketFloor || aboveMarket;
                      return (
                        <div key={rec.tier} className={clsx("border rounded-xl px-3 py-2.5", rec.color, tierBad && "opacity-60")}>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-semibold">{rec.tier} · {rec.m}×</span>
                            <span className="text-base font-bold">RM {sell.toFixed(2)}</span>
                          </div>
                          <p className="text-xs opacity-70 mt-0.5">
                            {lang === "zh" ? `利润 RM ${profit.toFixed(2)} · 利润率 ${marginPct}%` : `Profit RM ${profit.toFixed(2)} · ${marginPct}% margin`}
                          </p>
                          {myMax > 0 && (
                            <p className={clsx("text-[11px] font-semibold mt-1", tierBad ? "text-red-600" : "text-green-700")}>
                              {belowMarketFloor
                                ? (lang === "zh" ? `⚠️ 市场已有更低价 RM ${myMin.toFixed(2)}，难卖` : `⚠️ Market already sells at RM ${myMin.toFixed(2)} — hard to sell`)
                                : aboveMarket
                                  ? (lang === "zh" ? `⚠️ 高于市场价 ${Math.round((sell / myMax - 1) * 100)}%，难卖` : `⚠️ ${Math.round((sell / myMax - 1) * 100)}% above market — hard to sell`)
                                  : (lang === "zh" ? "✓ 在市场价范围内" : "✓ Within market range")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {myMax > 0 && (() => {
                    // Market verdict: what actually happens if you price AT the market.
                    const marginAtMarket = myMin - cost;
                    const marginPctAtMarket = myMin > 0 ? Math.round((marginAtMarket / myMin) * 100) : 0;
                    const marketLabel = myMin === myMax
                      ? `RM ${myMin.toFixed(2)}`
                      : `RM ${myMin.toFixed(2)}–${myMax.toFixed(2)}`;
                    const verdict = marginAtMarket <= 0
                      ? { cls: "text-red-700 bg-red-50 border-red-200",
                          zh: `⚠️ 马来最低售价 RM ${myMin.toFixed(2)} 已低于你的进货成本 RM ${cost.toFixed(2)} —— 想卖得动就得亏本，建议换更便宜货源或换品。`,
                          en: `⚠️ The cheapest MY seller (RM ${myMin.toFixed(2)}) is already below your cost (RM ${cost.toFixed(2)}) — you'd have to sell at a loss; find a cheaper source or another product.` }
                      : marginPctAtMarket < 25
                      ? { cls: "text-amber-800 bg-amber-50 border-amber-200",
                          zh: `⚠️ 按市场价卖（约 RM ${myMin.toFixed(2)}），利润只有 RM ${marginAtMarket.toFixed(2)}（${marginPctAtMarket}%）—— 利润空间小，建议找更便宜的货源，或谨慎入场。`,
                          en: `⚠️ Selling at market (≈RM ${myMin.toFixed(2)}) leaves only RM ${marginAtMarket.toFixed(2)} (${marginPctAtMarket}%) — thin margin; find a cheaper source or proceed carefully.` }
                      : { cls: "text-green-800 bg-green-50 border-green-200",
                          zh: `✅ 按市场价卖（约 RM ${myMin.toFixed(2)}）利润 RM ${marginAtMarket.toFixed(2)}（${marginPctAtMarket}%）—— 有利润空间，值得考虑。`,
                          en: `✅ Selling at market (≈RM ${myMin.toFixed(2)}) earns RM ${marginAtMarket.toFixed(2)} (${marginPctAtMarket}%) — healthy margin, worth considering.` };
                    return (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        <p className="text-xs text-slate-400">
                          {lang === "zh" ? `马来市场同类售价 ${marketLabel}` : `MY market price ${marketLabel}`}
                        </p>
                        <p className={clsx("text-xs leading-relaxed border rounded-lg px-3 py-2 font-medium", verdict.cls)}>
                          {lang === "zh" ? verdict.zh : verdict.en}
                        </p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 leading-relaxed">
                    {lang === "zh"
                      ? "💡 对比里加一个 1688 / 淘宝 / 拼多多 商品，就能看到「成本 + 利润」定价。以下按竞品均价参考："
                      : "💡 Add a 1688 / Taobao / PDD product to get cost + margin pricing. Competitor-avg reference below:"}
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { tier: lang === "zh" ? "高竞争力" : "Competitive", price: (avgPrice * 0.88).toFixed(2), desc: lang === "zh" ? "低于均价 12%" : "12% below avg", color: "bg-green-50 border-green-200 text-green-800" },
                      { tier: lang === "zh" ? "市场水平" : "Market Rate", price: avgPrice.toFixed(2), desc: lang === "zh" ? "与竞品持平" : "Same as market", color: "bg-blue-50 border-blue-200 text-blue-800" },
                      { tier: lang === "zh" ? "品牌溢价" : "Premium", price: (avgPrice * 1.12).toFixed(2), desc: lang === "zh" ? "高于均价 12%" : "12% above avg", color: "bg-purple-50 border-purple-200 text-purple-800" },
                    ].map((rec) => (
                      <div key={rec.tier} className={clsx("border rounded-xl px-3 py-2.5", rec.color)}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold">{rec.tier}</span>
                          <span className="text-base font-bold">RM {rec.price}</span>
                        </div>
                        <p className="text-xs opacity-70 mt-0.5">{rec.desc}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </main>

      {analyzeProduct && (
        <SuperAnalysisModal
          product={{
            name: analyzeProduct.name,
            price: analyzeProduct.price,
            sales: analyzeProduct.sales,
            reviews: analyzeProduct.reviews,
            rating: analyzeProduct.rating,
            shopName: analyzeProduct.shopName || "未知店铺",
            shopAge: analyzeProduct.shopAge || 12,
            platform: analyzeProduct.platform,
            imageUrl: analyzeProduct.imageUrl,
            url: analyzeProduct.url,
          }}
          marketAvgPrice={avgPrice || analyzeProduct.price}
          allPrices={products.map((p) => p.price)}
          onClose={() => setAnalyzeProduct(null)}
        />
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
