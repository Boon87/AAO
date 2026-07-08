"use client";

import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/mock-data";

// Stable identity for a listing across searches, so re-saving the same product
// later lines up as a trend point. Strip query params (tracking) from the URL.
export function productKey(p: { platform: string; url?: string; name: string }): string {
  const url = (p.url || "").split("?")[0].trim();
  if (url && url !== "#") return `${p.platform}|${url}`;
  return `${p.platform}|${p.name.slice(0, 40)}`;
}

// Each save inserts a SNAPSHOT row (price/reviews/likes/rating at that moment),
// so the watchlist can show change over time when you re-check a product.
export async function saveSnapshot(p: Product, query: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("请先登录");
  const { error } = await supabase.from("saved_products").insert({
    user_id: user.id,
    product_id: productKey(p),
    name: p.name,
    price: p.price,
    platform: p.platform,
    image_url: p.imageUrl || null,
    product_url: p.url || null,
    shop_name: p.shopName || null,
    reviews: p.reviews || 0,
    likes: p.likes || 0,
    rating: p.rating || 0,
    query: query || null,
  });
  if (error) throw error;
}

// Remove ALL snapshots of a product from the watchlist.
export async function removeProduct(productId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("saved_products").delete().eq("user_id", user.id).eq("product_id", productId);
}

// The set of product keys the user has saved (for showing saved state on cards).
export async function getSavedKeys(): Promise<Set<string>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase.from("saved_products").select("product_id").eq("user_id", user.id);
  return new Set((data || []).map((r) => r.product_id as string));
}
