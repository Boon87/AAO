import type { AuthenticityLevel } from "./mock-data";

interface ProductData {
  sales: number;
  reviews: number;
  price: number;
  shopAge: number; // months
  marketAvgPrice?: number;
}

export interface AuthenticityResult {
  score: number;
  level: AuthenticityLevel;
  flags: string[];
}

const ROUND_NUMBERS = new Set([
  100, 200, 300, 500, 1000, 2000, 3000, 5000,
  10000, 15000, 20000, 30000, 50000, 100000,
]);

export function calculateAuthenticityScore(data: ProductData): AuthenticityResult {
  let score = 100;
  const flags: string[] = [];

  // 1. Sales / Review ratio (max -30)
  if (data.reviews === 0 && data.sales > 200) {
    score -= 30;
    flags.push(`有 ${data.sales.toLocaleString()} 销量但零评论`);
  } else if (data.reviews > 0) {
    const ratio = Math.round(data.sales / data.reviews);
    if (ratio > 300) {
      score -= 30;
      flags.push(`销量与评论比例异常（${ratio}:1）`);
    } else if (ratio > 150) {
      score -= 15;
      flags.push(`销量评论比偏高（${ratio}:1）`);
    } else if (ratio > 80) {
      score -= 5;
    }
  }

  // 2. Round sales numbers (max -20)
  if (ROUND_NUMBERS.has(data.sales)) {
    score -= 20;
    flags.push(`销量为整数（${data.sales.toLocaleString()}）`);
  }

  // 3. New shop with very high sales (max -30)
  if (data.shopAge > 0 && data.shopAge < 3 && data.sales > 500) {
    score -= 30;
    flags.push(`新店铺但销量极高（店龄 ${data.shopAge} 个月）`);
  } else if (data.shopAge > 0 && data.shopAge < 6 && data.sales > 3000) {
    score -= 20;
    flags.push(`较新店铺但销量很高（店龄 ${data.shopAge} 个月）`);
  } else if (data.shopAge > 0 && data.shopAge < 12 && data.sales > 10000) {
    score -= 10;
  }

  // 4. Price significantly below market average (max -20)
  if (data.marketAvgPrice && data.marketAvgPrice > 0 && data.price > 0) {
    const ratio = data.price / data.marketAvgPrice;
    if (ratio < 0.4) {
      score -= 20;
      flags.push(`价格比市场均价低 ${Math.round((1 - ratio) * 100)}%`);
    } else if (ratio < 0.6) {
      score -= 10;
      flags.push(`价格明显低于市场均价`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  const level: AuthenticityLevel = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return { score, level, flags };
}
