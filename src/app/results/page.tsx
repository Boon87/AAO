"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, SlidersHorizontal, GitCompare, ArrowUpDown,
  ChevronDown, SearchX, RotateCcw, Loader2, AlertCircle, ExternalLink,
} from "lucide-react";
import { clsx } from "clsx";
import { Navbar } from "@/components/navbar";
import { ProductCard } from "@/components/product-card";
import { SuperAnalysisModal } from "@/components/super-analysis-modal";
import { PLATFORM_LABELS, type Platform, type Product } from "@/lib/mock-data";
import { calculateAuthenticityScore } from "@/lib/authenticity";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

// CNY to MYR approximate rate (used for Chinese platforms)
const CNY_TO_MYR = 0.63;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTaobaoData(raw: any): Product[] {
  if (!raw) return [];
  const items: any[] = raw.items ?? raw.data?.items ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!items.length) return [];
  const prices = items.map((i: any) => parseFloat(i.price) * CNY_TO_MYR).filter(p => p > 0); // eslint-disable-line @typescript-eslint/no-explicit-any
  const marketAvg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  return items.slice(0, 20).map((i: any, idx: number): Product => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const rawPrice = String(i.price || "0").replace(/[¥,]/g, "");
    const priceCny = parseFloat(rawPrice) || 0;
    const price = parseFloat((priceCny * CNY_TO_MYR).toFixed(2));
    const sales = parseInt(String(i.sales).replace(/[^0-9]/g, "")) || 0;
    const { score, level, flags } = calculateAuthenticityScore({ sales, reviews: 0, price, shopAge: 24, marketAvgPrice: marketAvg });
    return {
      id: `taobao-${idx}-${Date.now()}`,
      name: i.name || i.title || "未知商品",
      price, sales, reviews: 0, rating: 0,
      platform: "taobao",
      shopName: i.shop || "淘宝卖家",
      shopAge: 24,
      imageUrl: i.image ? (i.image.startsWith("//") ? "https:" + i.image : i.image) : "https://placehold.co/200x200/fef2f2/dc2626?text=淘宝",
      url: i.itemUrl?.startsWith("http") ? i.itemUrl : (i.itemUrl ? "https:" + i.itemUrl : "https://www.taobao.com"),
      authenticityScore: score, authenticityLevel: level, authenticityFlags: flags,
    };
  }).filter(p => p.name && p.price > 0 && p.price < 50000);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePddData(raw: any): Product[] {
  if (!raw) return [];
  const items: any[] = raw.items ?? raw.data?.items ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!items.length) return [];
  const prices = items.map((i: any) => parseFloat(i.price) * CNY_TO_MYR).filter(p => p > 0); // eslint-disable-line @typescript-eslint/no-explicit-any
  const marketAvg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  return items.slice(0, 20).map((i: any, idx: number): Product => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const priceCny = parseFloat(i.price) || 0;
    const price = parseFloat((priceCny * CNY_TO_MYR).toFixed(2));
    const sales = parseInt(String(i.sales).replace(/[^0-9万]/g, "").replace("万", "0000")) || 0;
    const { score, level, flags } = calculateAuthenticityScore({ sales, reviews: 0, price, shopAge: 18, marketAvgPrice: marketAvg });
    return {
      id: `pdd-${idx}-${Date.now()}`,
      name: i.name || i.title || "未知商品",
      price, sales, reviews: 0, rating: 0,
      platform: "pinduoduo",
      shopName: i.shop || "拼多多商家",
      shopAge: 18,
      imageUrl: i.image || "https://placehold.co/200x200/f0fdf4/16a34a?text=拼多多",
      url: i.itemUrl || "https://www.pinduoduo.com",
      authenticityScore: score, authenticityLevel: level, authenticityFlags: flags,
    };
  }).filter(p => p.name && p.price > 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parse1688Data(raw: any): Product[] {
  if (!raw) return [];
  const items: any[] = raw.items ?? raw.data?.items ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!items.length) return [];
  const prices = items.map((i: any) => parseFloat(i.price) * CNY_TO_MYR).filter(p => p > 0); // eslint-disable-line @typescript-eslint/no-explicit-any
  const marketAvg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  return items.slice(0, 20).map((i: any, idx: number): Product => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const priceCny = parseFloat(i.price) || 0;
    const price = parseFloat((priceCny * CNY_TO_MYR).toFixed(2));
    const sales = parseInt(String(i.sales).replace(/[^0-9]/g, "")) || 0;
    const { score, level, flags } = calculateAuthenticityScore({ sales, reviews: 0, price, shopAge: parseInt(String(i.shopAge)) || 36, marketAvgPrice: marketAvg });
    return {
      id: `1688-${idx}-${Date.now()}`,
      name: i.name || i.title || "未知商品",
      price, sales, reviews: 0, rating: 0,
      platform: "1688",
      shopName: i.shop || "1688供应商",
      shopAge: parseInt(String(i.shopAge)) || 36,
      imageUrl: i.image ? (i.image.startsWith("//") ? "https:" + i.image : i.image) : "https://placehold.co/200x200/fefce8/ca8a04?text=1688",
      url: i.itemUrl || "https://www.1688.com",
      authenticityScore: score, authenticityLevel: level, authenticityFlags: flags,
    };
  }).filter(p => p.name && p.price > 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLazadaData(rawPayload: any): Product[] {
  const BASE = "https://www.lazada.com.my";
  const payload = rawPayload?.source ? rawPayload : { source: "direct", data: rawPayload };

  if (payload.source === "dom" && Array.isArray(payload.items)) {
    return payload.items.slice(0, 20).map((raw: any, i: number): Product => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const price = parseFloat(raw.price) || 0;
      const { score, level, flags } = calculateAuthenticityScore({ sales: 0, reviews: 0, price, shopAge: 12, marketAvgPrice: 0 });
      return {
        id: `lazada-dom-${i}`, name: raw.name || "未知商品", price,
        sales: 0, reviews: 0, rating: 0, platform: "lazada",
        shopName: "Lazada 卖家", shopAge: 12,
        imageUrl: raw.image || "https://placehold.co/200x200/eff6ff/2563eb?text=Lazada",
        url: raw.itemUrl ? `${BASE}${raw.itemUrl}` : BASE,
        authenticityScore: score, authenticityLevel: level, authenticityFlags: flags,
      };
    });
  }

  const data = payload.data ?? payload;
  const items: unknown[] =
    data?.listItems ??           // nextdata / direct
    data?.mods?.listItems ??     // embedded script JSON
    data?.data?.resultList ??    // Lazada AJAX API
    data?.data?.listItems ??
    [];
  if (!items.length) return [];

  const prices = items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => parseFloat(i.price ?? "0"))
    .filter((p) => p > 0);
  const marketAvg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.slice(0, 20).map((raw: any): Product => {
    const price = parseFloat(raw.price ?? raw.priceShow ?? "0") || 0;
    const originalPrice = parseFloat(raw.originalPrice ?? "0") || undefined;
    const reviews = parseInt(raw.review ?? raw.ratingCount ?? "0") || 0;
    const sales = reviews * 8;
    const rating = parseFloat(raw.ratingScore ?? "0") || 0;
    const imageUrl = raw.image || raw.imgUrl || raw.mainImages?.[0] ||
      raw.sku_base?.img || raw.skuInfos?.[0]?.img || raw.img ||
      "https://placehold.co/200x200/eff6ff/2563eb?text=Lazada";
    const { score, level, flags } = calculateAuthenticityScore({
      sales, reviews, price, shopAge: 12, marketAvgPrice: marketAvg,
    });
    return {
      id: `lazada-${raw.itemId ?? raw.productUrl ?? Math.random()}`,
      name: raw.name ?? raw.title ?? "未知商品",
      price, sales, reviews, rating,
      originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
      platform: "lazada",
      shopName: raw.sellerName ?? raw.brandName ?? "Lazada 卖家",
      shopAge: 12, imageUrl,
      url: raw.itemUrl ? `${BASE}${raw.itemUrl}` : BASE,
      authenticityScore: score, authenticityLevel: level, authenticityFlags: flags,
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseShopeeData(data: any): Product[] {
  const items: unknown[] = data?.items ?? data?.data?.items ?? [];
  if (!items.length) return [];
  const prices = (items as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
    .map((i: any) => (i.item_basic?.price_min ?? i.item_basic?.price ?? 0) / 100000) // eslint-disable-line @typescript-eslint/no-explicit-any
    .filter((p) => p > 0);
  const marketAvg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (items as any[]).slice(0, 20).map((raw: any): Product => {
    const b = raw.item_basic ?? raw;
    const price = (b.price_min ?? b.price ?? 0) / 100000;
    const originalPrice = b.price ? b.price / 100000 : undefined;
    const sales = b.historical_sold ?? b.sold ?? 0;
    const reviews = b.cmt_count ?? 0;
    const rating = b.item_rating?.rating_star ?? 0;
    const imageHash = b.image ?? "";
    const imageUrl = imageHash
      ? `https://down-my.img.susercontent.com/file/${imageHash}_tn.webp`
      : "https://placehold.co/200x200/f0f9ff/1e40af?text=Shopee";
    const shopName = b._shop_name || b.username || "Shopee 卖家";
    const shopAge = b._shop_ctime
      ? Math.floor((Date.now() / 1000 - b._shop_ctime) / (30 * 24 * 3600))
      : 12;
    const { score, level, flags } = calculateAuthenticityScore({
      sales, reviews, price, shopAge, marketAvgPrice: marketAvg,
    });
    return {
      id: `shopee-${b.itemid}`,
      name: b.name ?? "未知商品",
      price, sales, reviews, rating,
      originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
      platform: "shopee",
      shopName,
      shopAge, imageUrl,
      url: `https://shopee.com.my/product/${b.shopid}/${b.itemid}`,
      authenticityScore: score, authenticityLevel: level, authenticityFlags: flags,
    };
  });
}

type SortOption = "price_asc" | "authenticity_desc" | "sales_desc";

interface SearchData {
  products: Product[];
  marketAvgPrice: number;
  marketMinPrice: number;
  marketMaxPrice: number;
  errors: string[];
}

async function saveSearchHistory(query: string, platforms: string[], allProducts: Product[]) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const suspiciousCount = allProducts.filter((p) => p.authenticityLevel === "low").length;
    await supabase.from("search_history").insert({
      user_id: user.id,
      query,
      platforms,
      result_count: allProducts.length,
      suspicious_count: suspiciousCount,
    });
  } catch {
    // Non-critical — ignore errors
  }
}

function ResultsContent() {
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const platformsParam = searchParams.get("platforms") || "shopee,lazada";

  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [extensionMissing, setExtensionMissing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("price_asc");
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");
  const [filterAuthenticity, setFilterAuthenticity] = useState<"all" | "high" | "medium" | "low">("all");
  const [newQuery, setNewQuery] = useState(query);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(platformsParam.split(",").filter(Boolean));
  const [superAnalysisProduct, setSuperAnalysisProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setFetchError("");
    setExtensionMissing(false);
    setData(null);
    setSelectedIds([]);

    const platforms = platformsParam.split(",");
    let cancelled = false;

    function askExtension(msgType: string, resultType: string, timeoutMs = 10000): Promise<unknown> {
      return new Promise((resolve) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const timer = setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve(null);
        }, timeoutMs);

        const handler = (e: MessageEvent) => {
          if (e.data?.type !== resultType || e.data?.requestId !== requestId) return;
          clearTimeout(timer);
          window.removeEventListener("message", handler);
          resolve(e.data.error ? null : (e.data.data ?? null));
        };

        window.addEventListener("message", handler);
        window.postMessage({ type: msgType, keyword: query, requestId }, "*");
      });
    }

    const shopeePromise: Promise<Product[]> = platforms.includes("shopee")
      ? askExtension("AAO_SHOPEE_SEARCH", "AAO_SHOPEE_RESULT", 25000).then((d) => {
          if (!d) { setExtensionMissing(true); return []; }
          return parseShopeeData(d);
        })
      : Promise.resolve([]);

    const lazadaPromise: Promise<Product[]> = platforms.includes("lazada")
      ? askExtension("AAO_LAZADA_SEARCH", "AAO_LAZADA_RESULT", 20000).then((d) => {
          if (!d) return [];
          return parseLazadaData(d);
        })
      : Promise.resolve([]);

    const taobaoPromise: Promise<Product[]> = platforms.includes("taobao")
      ? askExtension("AAO_TAOBAO_SEARCH", "AAO_TAOBAO_RESULT", 25000).then((d) => {
          if (!d) return [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return parseTaobaoData(d as any);
        })
      : Promise.resolve([]);

    const pddPromise: Promise<Product[]> = platforms.includes("pinduoduo")
      ? askExtension("AAO_PDD_SEARCH", "AAO_PDD_RESULT", 25000).then((d) => {
          if (!d) return [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return parsePddData(d as any);
        })
      : Promise.resolve([]);

    const p1688Promise: Promise<Product[]> = platforms.includes("1688")
      ? askExtension("AAO_1688_SEARCH", "AAO_1688_RESULT", 25000).then((d) => {
          if (!d) return [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return parse1688Data(d as any);
        })
      : Promise.resolve([]);

    Promise.all([shopeePromise, lazadaPromise, taobaoPromise, pddPromise, p1688Promise])
      .then(([shopeeProducts, lazadaProducts, taobaoProducts, pddProducts, p1688Products]) => {
        if (cancelled) return;
        const allProducts = [...shopeeProducts, ...lazadaProducts, ...taobaoProducts, ...pddProducts, ...p1688Products];
        const prices = allProducts.map((p) => p.price).filter((p) => p > 0);
        const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        setData({
          products: allProducts,
          marketAvgPrice: avg,
          marketMinPrice: prices.length ? Math.min(...prices) : 0,
          marketMaxPrice: prices.length ? Math.max(...prices) : 0,
          errors: [],
        });
        setLoading(false);
        saveSearchHistory(query, platforms, allProducts);
      })
      .catch(() => { if (!cancelled) { setFetchError(t("res_search_failed")); setLoading(false); } });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, platformsParam]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const toggleSearchPlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleNewSearch = () => {
    if (!newQuery.trim() || selectedPlatforms.length === 0) return;
    router.push(`/results?q=${encodeURIComponent(newQuery.trim())}&platforms=${selectedPlatforms.join(",")}`);
  };

  const allProducts = data?.products ?? [];

  // AI Smart Pick: relevance filter + weighted score (credibility 40% + price 30% + sales 30%)
  const aiTopPicks = (() => {
    if (allProducts.length < 2) return [];

    // Build keyword tokens from query (split by spaces, min 2 chars)
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);

    // A product is relevant if its name contains at least half the query tokens
    const isRelevant = (name: string) => {
      if (tokens.length === 0) return true;
      const lower = name.toLowerCase();
      const matched = tokens.filter(t => lower.includes(t)).length;
      return matched >= Math.ceil(tokens.length / 2);
    };

    const candidates = allProducts.filter(p => isRelevant(p.name));
    const pool = candidates.length >= 2 ? candidates : allProducts; // fallback to all if too few match

    const maxPrice = Math.max(...pool.map(p => p.price));
    const minPrice = Math.min(...pool.map(p => p.price));
    const maxSales = Math.max(...pool.map(p => p.sales));
    const priceRange = maxPrice - minPrice || 1;
    return pool
      .map(p => {
        const credScore  = p.authenticityScore;
        const priceScore = maxPrice > 0 ? ((maxPrice - p.price) / priceRange) * 100 : 50;
        const salesScore = maxSales > 0 ? (p.sales / maxSales) * 100 : 0;
        const total = credScore * 0.4 + priceScore * 0.3 + salesScore * 0.3;
        const tag = credScore >= 70 && priceScore >= 60 && salesScore >= 40 ? "综合最优" :
                    credScore >= 75 ? "可信度最高" :
                    priceScore >= 80 ? "性价比最高" :
                    salesScore >= 80 ? "销量最高" : "推荐";
        return { ...p, aiScore: Math.round(total), aiTag: tag };
      })
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 4);
  })();

  const filtered = allProducts
    .filter((p) => filterPlatform === "all" || p.platform === filterPlatform)
    .filter((p) => filterAuthenticity === "all" || p.authenticityLevel === filterAuthenticity)
    .sort((a, b) => {
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "authenticity_desc") return b.authenticityScore - a.authenticityScore;
      if (sortBy === "sales_desc") return b.sales - a.sales;
      return 0;
    });

  const platformCounts = allProducts.reduce((acc, p) => {
    acc[p.platform] = (acc[p.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {superAnalysisProduct && (
        <SuperAnalysisModal
          product={{
            name: superAnalysisProduct.name,
            price: superAnalysisProduct.price,
            sales: superAnalysisProduct.sales,
            reviews: superAnalysisProduct.reviews,
            rating: superAnalysisProduct.rating,
            shopName: superAnalysisProduct.shopName || "未知店铺",
            shopAge: superAnalysisProduct.shopAge || 12,
            platform: superAnalysisProduct.platform,
            imageUrl: superAnalysisProduct.imageUrl,
            url: superAnalysisProduct.url,
          }}
          marketAvgPrice={data?.marketAvgPrice || superAnalysisProduct.price}
          allPrices={(data?.products || []).map(p => p.price)}
          onClose={() => setSuperAnalysisProduct(null)}
        />
      )}
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">

        {/* Top search bar */}
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2 bg-white border-2 border-slate-200 focus-within:border-blue-500 rounded-xl px-3 py-2 transition-colors">
              <Search className="w-4 h-4 text-slate-400 self-center shrink-0" />
              <input value={newQuery} onChange={(e) => setNewQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNewSearch()}
                className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
                placeholder={t("res_re_search")} />
            </div>
            <button onClick={handleNewSearch} disabled={selectedPlatforms.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium px-5 rounded-xl transition-colors">
              {t("dash_search_btn")}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {[
              { id: "shopee",    label: "Shopee",  active: "bg-orange-100 text-orange-700 border-orange-300" },
              { id: "lazada",    label: "Lazada",  active: "bg-blue-100 text-blue-700 border-blue-300" },
              { id: "taobao",    label: "淘宝",    active: "bg-red-100 text-red-700 border-red-300" },
              { id: "pinduoduo", label: "拼多多",  active: "bg-green-100 text-green-700 border-green-300" },
              { id: "1688",      label: "1688",    active: "bg-amber-100 text-amber-700 border-amber-300" },
            ].map(p => (
              <button key={p.id} onClick={() => toggleSearchPlatform(p.id)}
                className={clsx("px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                  selectedPlatforms.includes(p.id) ? p.active : "bg-white text-slate-400 border-slate-200")}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-slate-500 text-sm">
              {lang === "zh" ? `正在搜索「${query}」…` : `Searching for "${query}"…`}
            </p>
          </div>
        )}

        {/* Fetch error */}
        {!loading && fetchError && (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-slate-700 font-semibold">{fetchError}</p>
            <button onClick={() => router.refresh()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm text-slate-700 transition-colors">
              <RotateCcw className="w-4 h-4" />{t("res_retry")}
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && !fetchError && data && (
          <>
            {extensionMissing && platformsParam.includes("shopee") && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {t("res_extension_missing")}
              </div>
            )}

            {data.errors.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {data.errors.join("、")} 暂时无法连接，只显示其余平台结果
              </div>
            )}

            {/* Summary row */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-lg font-bold text-slate-800">
                  {lang === "zh" ? `「${query}」${t("res_results_for")}` : `"${query}" ${t("res_results_for")}`}
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {lang === "zh"
                    ? `共找到 ${allProducts.length} 件产品${data.marketAvgPrice > 0 ? ` · 市场均价 RM ${data.marketAvgPrice.toFixed(2)}` : ""}`
                    : `Found ${allProducts.length} products${data.marketAvgPrice > 0 ? ` · Market avg RM ${data.marketAvgPrice.toFixed(2)}` : ""}`}
                </p>
              </div>
              {selectedIds.length >= 2 && (
                <button onClick={() => {
                  const selected = allProducts.filter(p => selectedIds.includes(p.id));
                  sessionStorage.setItem("aao_compare_products", JSON.stringify(selected));
                  router.push(`/compare?ids=${selectedIds.join(",")}`);
                }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <GitCompare className="w-4 h-4" />
                  {t("res_compare_btn")} ({selectedIds.length} {t("res_items_unit")})
                </button>
              )}
            </div>

            {/* Filter bar */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 shrink-0">
                <SlidersHorizontal className="w-4 h-4" />{t("res_filter")}
              </span>

              <div className="flex flex-wrap gap-1.5">
                {(["all", "shopee", "lazada", "taobao", "pinduoduo", "1688"] as const).map((p) => {
                  const count = p === "all" ? allProducts.length : (platformCounts[p] || 0);
                  if (p !== "all" && count === 0) return null;
                  return (
                    <button key={p} onClick={() => setFilterPlatform(p)}
                      className={clsx("px-3 py-1 rounded-lg text-xs font-medium transition-colors border",
                        filterPlatform === p
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
                      {p === "all" ? `${t("res_all_platforms")} (${count})` : `${PLATFORM_LABELS[p]} (${count})`}
                    </button>
                  );
                })}
              </div>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              <div className="flex gap-1.5 flex-wrap">
                {([
                  { value: "all", label: t("res_authenticity_all") },
                  { value: "high", label: t("res_authenticity_high") },
                  { value: "medium", label: t("res_authenticity_medium") },
                  { value: "low", label: t("res_authenticity_low") },
                ] as const).map((opt) => (
                  <button key={opt.value} onClick={() => setFilterAuthenticity(opt.value)}
                    className={clsx("px-3 py-1 rounded-lg text-xs font-medium transition-colors border",
                      filterAuthenticity === opt.value
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">{t("res_sort")}</span>
                <div className="relative">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 pr-6 bg-white text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                    <option value="price_asc">价格从低到高</option>
                    <option value="authenticity_desc">可信度从高到低</option>
                    <option value="sales_desc">销量从高到低</option>
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {selectedIds.length === 1 && (
              <p className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
                {t("res_select_hint")}
              </p>
            )}

            {/* AI Smart Pick */}
            {aiTopPicks.length >= 1 && (
              <div className="mb-6 bg-gradient-to-r from-slate-900 to-slate-700 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-yellow-400 text-base">🤖</span>
                  <span className="font-bold text-white text-sm">AI 智能选品推荐</span>
                  <span className="text-xs text-slate-400 ml-1">综合可信度 · 价格 · 销量 四款最优</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {aiTopPicks.map((product, i) => {
                    const tagColors: Record<string, string> = {
                      "综合最优":   "bg-yellow-400 text-yellow-900",
                      "可信度最高": "bg-green-400 text-green-900",
                      "性价比最高": "bg-blue-400 text-blue-900",
                      "销量最高":   "bg-purple-400 text-purple-900",
                      "推荐":       "bg-slate-400 text-slate-900",
                    };
                    const rankLabel = ["🥇", "🥈", "🥉", "4️⃣"][i];
                    return (
                      <div key={product.id} className="bg-white/10 hover:bg-white/20 transition-colors rounded-xl p-3 relative flex flex-col">
                        <div className="cursor-pointer flex-1" onClick={() => setSuperAnalysisProduct(product)}>
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-base">{rankLabel}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tagColors[product.aiTag] || tagColors["推荐"]}`}>
                              {product.aiTag}
                            </span>
                          </div>
                          {product.imageUrl && (
                            <img src={product.imageUrl} alt="" className="w-full h-20 object-cover rounded-lg mb-2" />
                          )}
                          <p className="text-white text-xs font-medium line-clamp-2 mb-2">{product.name}</p>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-yellow-300 font-bold text-sm">RM {product.price}</span>
                            <span className="text-slate-400 text-xs">评分 {product.aiScore}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              product.authenticityLevel === "high" ? "bg-green-900/50 text-green-300" :
                              product.authenticityLevel === "medium" ? "bg-yellow-900/50 text-yellow-300" :
                              "bg-red-900/50 text-red-300"}`}>
                              可信 {product.authenticityScore}分
                            </span>
                            {product.sales > 0 && <span className="text-slate-400 text-xs">{product.sales}销量</span>}
                          </div>
                        </div>
                        {product.url && product.url !== "#" && (
                          <a href={product.url} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-white/15 hover:bg-white/30 text-white text-xs font-medium transition-colors mt-auto">
                            <ExternalLink className="w-3 h-3" />
                            前往 {PLATFORM_LABELS[product.platform]}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No results */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-5">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                  <SearchX className="w-9 h-9 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-700">{t("res_no_results")}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {filterPlatform !== "all" || filterAuthenticity !== "all"
                      ? t("res_no_filter")
                      : lang === "zh"
                        ? `在已选平台上找不到「${query}」相关的产品`
                        : `No results for "${query}" on selected platforms`}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 w-full max-w-sm space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("res_tip_title")}</p>
                  {(filterPlatform !== "all" || filterAuthenticity !== "all") && (
                    <button onClick={() => { setFilterPlatform("all"); setFilterAuthenticity("all"); }}
                      className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl text-sm text-slate-700 transition-colors">
                      <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />{t("res_clear_filter")}
                    </button>
                  )}
                  <button onClick={() => router.push("/dashboard")}
                    className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 rounded-xl text-sm text-slate-700 transition-colors">
                    <Search className="w-4 h-4 text-blue-600 shrink-0" />{t("res_new_search")}
                  </button>
                  <p className="text-xs text-slate-400 pt-1">{t("res_tip_text")}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((product) => (
                  <div key={product.id} className="relative group">
                    <ProductCard product={product}
                      selected={selectedIds.includes(product.id)}
                      onToggleSelect={toggleSelect} selectable />
                    <button
                      onClick={() => setSuperAnalysisProduct(product)}
                      className="absolute bottom-12 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 text-white text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1.5 shadow-lg z-10">
                      🔍 AI深度分析
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
