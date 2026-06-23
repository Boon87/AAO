"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Star, ShoppingBag, MessageSquare,
  TrendingUp, Info, CheckCircle, AlertTriangle, ExternalLink,
} from "lucide-react";
import { clsx } from "clsx";
import { Navbar } from "@/components/navbar";
import { AuthenticityBadge } from "@/components/authenticity-badge";
import { PLATFORM_LABELS, PLATFORM_COLORS, type Product } from "@/lib/mock-data";
import { useLanguage } from "@/lib/i18n";

function CompareContent() {
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = searchParams.get("ids")?.split(",") || [];

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
      render: (p) => <AuthenticityBadge score={p.authenticityScore} level={p.authenticityLevel} />,
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

            {/* Pricing recommendation */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-indigo-600" />
                <h2 className="font-semibold text-slate-800">{lang === "zh" ? "定价建议" : "Pricing Guide"}</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                {lang === "zh" ? `以所选均价 RM ${avgPrice.toFixed(2)} 为基准：` : `Based on avg RM ${avgPrice.toFixed(2)}:`}
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
            </div>

          </div>
        </div>
      </main>
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
