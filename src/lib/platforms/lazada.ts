import type { Product } from "@/lib/mock-data";
import { calculateAuthenticityScore } from "@/lib/authenticity";

const BASE = "https://www.lazada.com.my";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Referer": `${BASE}/`,
  "Accept": "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-GB,en;q=0.9,ms;q=0.8",
  "X-Requested-With": "XMLHttpRequest",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseItem(raw: any, marketAvgPrice: number): Product {
  const price = parseFloat(raw.price ?? raw.priceShow ?? "0") || 0;
  const originalPrice = parseFloat(raw.originalPrice ?? "0") || undefined;
  const sales = parseInt(raw.review ?? raw.ratingCount ?? "0") * 8 || 0; // Lazada doesn't expose sales; estimate
  const reviews = parseInt(raw.review ?? raw.ratingCount ?? "0") || 0;
  const rating = parseFloat(raw.ratingScore ?? "0") || 0;

  const imageUrl = raw.image || raw.mainImages?.[0]
    || "https://placehold.co/200x200/eff6ff/2563eb?text=Lazada";

  const { score, level, flags } = calculateAuthenticityScore({
    sales, reviews, price, shopAge: 12, marketAvgPrice,
  });

  return {
    id: `lazada-${raw.itemId ?? raw.productUrl ?? Math.random()}`,
    name: raw.name ?? raw.title ?? "未知商品",
    price,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
    sales,
    reviews,
    rating,
    platform: "lazada",
    shopName: raw.sellerName ?? raw.brandName ?? "Lazada 卖家",
    shopAge: 12,
    imageUrl,
    url: raw.itemUrl ? `${BASE}${raw.itemUrl}` : BASE,
    authenticityScore: score,
    authenticityLevel: level,
    authenticityFlags: flags,
  };
}

export async function searchLazada(keyword: string, limit = 20): Promise<Product[]> {
  const params = new URLSearchParams({
    ajax: "true",
    isFirstRequest: "true",
    q: keyword,
    page: "1",
    limit: String(limit),
    _keyori: "ss",
    from: "input",
  });

  const res = await fetch(`${BASE}/catalog/?${params}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Lazada returned ${res.status}`);

  const data = await res.json();
  // Lazada nests results under different paths depending on response version
  const items: unknown[] =
    data?.mods?.listItems ??
    data?.data?.resultList ??
    data?.listItems ??
    [];

  if (!items.length) return [];

  const prices = items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => parseFloat(i.price ?? "0"))
    .filter((p) => p > 0);
  const marketAvgPrice = prices.length
    ? prices.reduce((a, b) => a + b, 0) / prices.length
    : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.slice(0, limit).map((i: any) => parseItem(i, marketAvgPrice));
}
