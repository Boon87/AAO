import { NextRequest, NextResponse } from "next/server";
import { searchShopee } from "@/lib/platforms/shopee";
import { searchLazada } from "@/lib/platforms/lazada";
import type { Product } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("q")?.trim();
  const platforms = (searchParams.get("platforms") ?? "shopee,lazada,tiktok").split(",");

  if (!keyword) {
    return NextResponse.json({ error: "请提供搜索关键词" }, { status: 400 });
  }

  const results = await Promise.allSettled([
    platforms.includes("shopee") ? searchShopee(keyword) : Promise.resolve([]),
    platforms.includes("lazada") ? searchLazada(keyword) : Promise.resolve([]),
    // TikTok Shop: API not available yet — returns empty
    Promise.resolve([] as Product[]),
  ]);

  const products: Product[] = [];
  const errors: string[] = [];

  const labels = ["Shopee", "Lazada", "TikTok Shop"];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      products.push(...r.value);
    } else {
      console.error(`${labels[i]} 搜索失败:`, r.reason);
      errors.push(labels[i]);
    }
  });

  // Calculate overall market stats from all products
  const prices = products.map((p) => p.price).filter((p) => p > 0);
  const marketAvgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const marketMinPrice = prices.length ? Math.min(...prices) : 0;
  const marketMaxPrice = prices.length ? Math.max(...prices) : 0;

  return NextResponse.json({
    products,
    marketAvgPrice: Math.round(marketAvgPrice * 100) / 100,
    marketMinPrice: Math.round(marketMinPrice * 100) / 100,
    marketMaxPrice: Math.round(marketMaxPrice * 100) / 100,
    errors, // which platforms failed
  });
}
