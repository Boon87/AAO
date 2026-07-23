"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Trash2, ExternalLink, RotateCcw, TrendingUp, TrendingDown, Minus, Loader2, Trophy, ArrowDownWideNarrow, Clock } from "lucide-react";
import { clsx } from "clsx";
import { Navbar } from "@/components/navbar";
import { createClient } from "@/lib/supabase/client";
import { removeProduct } from "@/lib/watchlist";
import { computeOpportunityScore, GRADE_STYLES, type OpportunityScore } from "@/lib/opportunity-score";
import { PLATFORM_LABELS, PLATFORM_COLORS, type Platform } from "@/lib/mock-data";
import { useLanguage } from "@/lib/i18n";

interface Snap {
  product_id: string; name: string; price: number; platform: string;
  image_url: string | null; product_url: string | null; shop_name: string | null;
  reviews: number; likes: number; rating: number; query: string | null; saved_at: string;
}
interface Item {
  key: string; latest: Snap; first: Snap; snaps: number;
  dReviews: number; dLikes: number; dPrice: number;
  score: OpportunityScore;
}

export default function WatchlistPage() {
  const { lang } = useLanguage();
  const zh = lang === "zh";
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"score" | "recent">("score");
  const [openScore, setOpenScore] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from("saved_products").select("*")
      .eq("user_id", user.id).order("saved_at", { ascending: true });
    const groups = new Map<string, Snap[]>();
    for (const r of (data as Snap[] | null) || []) {
      const arr = groups.get(r.product_id) || [];
      arr.push(r);
      groups.set(r.product_id, arr);
    }
    const list: Item[] = [...groups.entries()].map(([key, snaps]) => {
      const first = snaps[0], latest = snaps[snaps.length - 1];
      return {
        key, latest, first, snaps: snaps.length,
        dReviews: (latest.reviews || 0) - (first.reviews || 0),
        dLikes: (latest.likes || 0) - (first.likes || 0),
        dPrice: +((latest.price || 0) - (first.price || 0)).toFixed(2),
        score: computeOpportunityScore(first, latest, snaps.length),
      };
    });
    setItems(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sorted = [...items].sort((a, b) =>
    sortBy === "score"
      ? b.score.total - a.score.total
      : new Date(b.latest.saved_at).getTime() - new Date(a.latest.saved_at).getTime()
  );
  const topKey = sortBy === "score" && sorted.length >= 2 && sorted[0].score.grade !== "D" ? sorted[0].key : null;

  const PART_LABELS: Record<string, [string, string]> = {
    demand: ["需求热度", "Demand"],
    momentum: ["上升动能", "Momentum"],
    price: ["价格走势", "Price trend"],
    rating: ["口碑", "Rating"],
    confidence: ["数据可信度", "Data confidence"],
  };
  const GRADE_LABELS: Record<string, [string, string]> = {
    A: ["优先跟进", "Top pick"],
    B: ["值得测试", "Worth testing"],
    C: ["继续观察", "Keep watching"],
    D: ["信号弱", "Weak signal"],
  };

  const handleRemove = async (key: string) => {
    await removeProduct(key);
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-1">
          <Bookmark className="w-5 h-5 text-amber-500" />
          <h1 className="text-xl font-bold text-slate-800">{zh ? "选品清单" : "Watchlist"}</h1>
        </div>
        <p className="text-sm text-slate-500 mb-4">{zh ? "收藏的候选品。再次搜索并收藏同一个品，这里会显示需求/价格的变化。" : "Saved candidates. Re-search and re-save the same product to see demand/price change here."}</p>

        {/* Feature 5: opportunity score — rank saved candidates against each other */}
        {items.length >= 2 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              <button onClick={() => setSortBy("score")} className={clsx("flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium transition-colors", sortBy === "score" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700")}>
                <ArrowDownWideNarrow className="w-3.5 h-3.5" />{zh ? "按机会分" : "By score"}
              </button>
              <button onClick={() => setSortBy("recent")} className={clsx("flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium transition-colors", sortBy === "recent" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700")}>
                <Clock className="w-3.5 h-3.5" />{zh ? "按最近收藏" : "By recent"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">{zh ? "机会分只用清单里已存的快照数据算出（0-100），复查次数越多越准。" : "Score (0-100) is computed only from saved snapshots — more re-checks = more accurate."}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 py-16 justify-center"><Loader2 className="w-5 h-5 animate-spin" />{zh ? "加载中…" : "Loading…"}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Bookmark className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{zh ? "还没有收藏的产品" : "No saved products yet"}</p>
            <p className="text-sm text-slate-400 mt-1">{zh ? "在搜索结果页点产品左上角的书签图标，加入清单。" : "Tap the bookmark on a product card in results to add it."}</p>
            <Link href="/dashboard" className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">{zh ? "去搜索" : "Search"}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((it) => {
              const p = it.latest;
              const Trend = ({ label, delta, unit }: { label: string; delta: number; unit?: string }) => {
                const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
                const cls = delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-slate-400";
                const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
                const val = unit === "RM" ? `RM ${Math.abs(delta).toFixed(2)}` : Math.abs(delta);
                return (
                  <span className={clsx("inline-flex items-center gap-0.5 tabular-nums", cls)}>
                    <Icon className="w-3 h-3" />{label} {sign}{val}
                  </span>
                );
              };
              const sc = it.score;
              const isTop = it.key === topKey;
              return (
                <div key={it.key} className={clsx("bg-white border rounded-2xl overflow-hidden flex flex-col", isTop ? "border-green-300 ring-1 ring-green-200" : "border-slate-200")}>
                  {isTop && (
                    <div className="flex items-center gap-1 bg-green-50 text-green-700 text-[11px] font-semibold px-3 py-1">
                      <Trophy className="w-3 h-3" />{zh ? "清单里目前信号最强的一个" : "Strongest signal in your list"}
                    </div>
                  )}
                  <div className="flex gap-3 p-3">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-100 shrink-0" />
                    ) : <div className="w-16 h-16 rounded-lg bg-slate-100 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-semibold", PLATFORM_COLORS[p.platform as Platform] || "bg-slate-100 text-slate-600")}>{PLATFORM_LABELS[p.platform as Platform] || p.platform}</span>
                        <button
                          onClick={() => setOpenScore(openScore === it.key ? null : it.key)}
                          title={zh ? "点开看评分构成" : "Tap for score breakdown"}
                          className={clsx("shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border tabular-nums transition-transform hover:scale-105", GRADE_STYLES[sc.grade])}
                        >
                          {sc.total} · {sc.grade} {zh ? GRADE_LABELS[sc.grade][0] : GRADE_LABELS[sc.grade][1]}
                        </button>
                      </div>
                      <p className="text-xs text-slate-700 font-medium mt-1 line-clamp-2 leading-snug">{p.name}</p>
                    </div>
                  </div>

                  {/* Score breakdown (tap the badge) */}
                  {openScore === it.key && (
                    <div className="mx-3 mb-2 text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2 space-y-1">
                      {sc.parts.map((part) => (
                        <div key={part.key} className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-slate-500">{zh ? PART_LABELS[part.key][0] : PART_LABELS[part.key][1]}</span>
                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(part.score / part.max) * 100}%` }} />
                          </div>
                          <span className="w-10 shrink-0 text-right tabular-nums text-slate-600">{part.score}/{part.max}</span>
                        </div>
                      ))}
                      {sc.singleSnapshot && (
                        <p className="text-amber-600 pt-0.5">{zh ? "只有 1 次快照，动能/价格走势是中性估值 —— 点「复查」后会变准。" : "Only 1 snapshot — momentum/price are neutral guesses. Re-check to firm them up."}</p>
                      )}
                    </div>
                  )}
                  <div className="px-3 pb-2 flex items-baseline justify-between">
                    <span className="text-lg font-bold text-slate-800">RM {(p.price || 0).toFixed(2)}</span>
                    <span className="text-[11px] text-slate-400">{zh ? "评价" : "rev"} {p.reviews || 0} · {zh ? "收藏" : "fav"} {p.likes || 0}</span>
                  </div>

                  {/* Trend since first saved */}
                  {it.snaps >= 2 ? (
                    <div className="mx-3 mb-2 text-[11px] bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="text-slate-400">{zh ? "自首次收藏:" : "since saved:"}</span>
                      <Trend label={zh ? "评价" : "rev"} delta={it.dReviews} />
                      <Trend label={zh ? "收藏" : "fav"} delta={it.dLikes} />
                      <Trend label={zh ? "价" : "price"} delta={it.dPrice} unit="RM" />
                    </div>
                  ) : (
                    <p className="mx-3 mb-2 text-[11px] text-slate-400">{zh ? `${it.snaps} 次快照 · 复查后可看涨跌` : `${it.snaps} snapshot · re-check to see trend`}</p>
                  )}

                  <div className="mt-auto border-t border-slate-100 grid grid-cols-3 divide-x divide-slate-100 text-xs">
                    {p.product_url ? (
                      <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 py-2 text-blue-600 hover:bg-blue-50 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />{zh ? "打开" : "Open"}
                      </a>
                    ) : <span className="py-2 text-center text-slate-300">—</span>}
                    {p.query ? (
                      <Link href={`/results?q=${encodeURIComponent(p.query)}&platforms=shopee,lazada,taobao,pinduoduo,1688`} className="flex items-center justify-center gap-1 py-2 text-slate-600 hover:bg-slate-50 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" />{zh ? "复查" : "Re-check"}
                      </Link>
                    ) : <span className="py-2 text-center text-slate-300">—</span>}
                    <button onClick={() => handleRemove(it.key)} className="flex items-center justify-center gap-1 py-2 text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />{zh ? "移除" : "Remove"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
