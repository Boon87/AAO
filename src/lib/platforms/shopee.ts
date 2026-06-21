import type { Product } from "@/lib/mock-data";
import { calculateAuthenticityScore } from "@/lib/authenticity";
import { createShopeeTask } from "@/lib/shopee-task-store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseItem(raw: any, marketAvgPrice: number): Product {
  const b = raw.item_basic ?? raw;
  const price = (b.price_min ?? b.price ?? 0) / 100000;
  const originalPrice = b.price ? b.price / 100000 : undefined;
  const sales = b.sold ?? b.historical_sold ?? 0;
  const reviews = b.cmt_count ?? 0;
  const rating = b.item_rating?.rating_star ?? 0;
  const imageHash = b.image ?? "";
  const imageUrl = imageHash
    ? `https://down-my.img.susercontent.com/file/${imageHash}_tn.webp`
    : "https://placehold.co/200x200/f0f9ff/1e40af?text=Shopee";

  const { score, level, flags } = calculateAuthenticityScore({
    sales, reviews, price, shopAge: 12, marketAvgPrice,
  });

  return {
    id: `shopee-${b.itemid}`,
    name: b.name ?? "未知商品",
    price,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
    sales,
    reviews,
    rating,
    platform: "shopee",
    shopName: b.shop_location ?? "Shopee 卖家",
    shopAge: 12,
    imageUrl,
    url: `https://shopee.com.my/-i.${b.shopid}.${b.itemid}`,
    authenticityScore: score,
    authenticityLevel: level,
    authenticityFlags: flags,
  };
}

export async function searchShopee(keyword: string, limit = 20): Promise<Product[]> {
  // Delegate to Chrome extension via task queue
  const data = await createShopeeTask(keyword) as { items?: unknown[] };

  const items: unknown[] = data?.items ?? [];
  if (!items.length) return [];

  const prices = items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => (i.item_basic?.price_min ?? i.item_basic?.price ?? 0) / 100000)
    .filter((p) => p > 0);
  const marketAvgPrice = prices.length
    ? prices.reduce((a, b) => a + b, 0) / prices.length
    : 0;

  return items
    .slice(0, limit)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => parseItem(i, marketAvgPrice));
}
