"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock, TrendingUp, ShoppingCart, X, Camera } from "lucide-react";
import { clsx } from "clsx";
import { Navbar } from "@/components/navbar";
import { ImageSearchModal } from "@/components/image-search-modal";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

const PLATFORMS = [
  { id: "shopee", label: "Shopee", color: "border-orange-400 bg-orange-50 text-orange-700" },
  { id: "lazada", label: "Lazada", color: "border-blue-400 bg-blue-50 text-blue-700" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(["shopee", "lazada"]);
  const [showImageModal, setShowImageModal] = useState(false);
  const EXAMPLE_SEARCHES = ["竹砧板", "收纳盒", "浴室置物架", "不锈钢汤锅", "硅胶垫"];
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [suspiciousCount, setSuspiciousCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadStats() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: rows } = await supabase
        .from("search_history")
        .select("query, suspicious_count, created_at")
        .eq("user_id", user.id)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false });

      if (rows) {
        setTodayCount(rows.length);
        setSuspiciousCount(rows.reduce((sum, r) => sum + (r.suspicious_count ?? 0), 0));
      }

      // Deduplicated recent searches
      const { data: history } = await supabase
        .from("search_history")
        .select("query")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (history) {
        const seen = new Set<string>();
        const unique: string[] = [];
        for (const row of history) {
          if (!seen.has(row.query)) {
            seen.add(row.query);
            unique.push(row.query);
            if (unique.length >= 5) break;
          }
        }
        setRecentSearches(unique);
      }
    }

    loadStats();
  }, []);

  const togglePlatform = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim() || selected.length === 0) return;
    router.push(`/results?q=${encodeURIComponent(searchQuery.trim())}&platforms=${selected.join(",")}`);
  };

  const handleImageIdentified = (productName: string) => {
    setQuery(productName);
    handleSearch(productName);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {showImageModal && (
        <ImageSearchModal onClose={() => setShowImageModal(false)} onIdentified={handleImageIdentified} />
      )}

      <main className="flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-full border border-blue-200 mb-4">
            <TrendingUp className="w-4 h-4" />
            {t("dash_badge")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-3">{t("dash_title")}</h1>
          <p className="text-slate-500 text-base max-w-md">{t("dash_subtitle")}</p>
        </div>

        <div className="w-full max-w-2xl">
          <div className="flex gap-2 bg-white border-2 border-slate-200 focus-within:border-blue-500 rounded-2xl p-2 shadow-sm transition-colors">
            <Search className="w-5 h-5 text-slate-400 self-center ml-2 shrink-0" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={t("dash_placeholder")}
              className="flex-1 text-slate-800 placeholder:text-slate-400 text-base focus:outline-none bg-transparent py-1" />
            {query && (
              <button onClick={() => setQuery("")} className="self-center text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setShowImageModal(true)} title={t("img_title")}
              className="self-center w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <Camera className="w-5 h-5" />
            </button>
            <button onClick={() => handleSearch()} disabled={!query.trim() || selected.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm shrink-0">
              {t("dash_search_btn")}
            </button>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-sm text-slate-500 shrink-0">{t("dash_platform_label")}</span>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button key={p.id} onClick={() => togglePlatform(p.id)}
                  className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                    selected.includes(p.id) ? p.color : "border-slate-200 bg-white text-slate-400")}>
                  <span className={clsx("w-4 h-4 rounded border-2 flex items-center justify-center",
                    selected.includes(p.id) ? "border-current bg-current" : "border-slate-300")}>
                    {selected.includes(p.id) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                      </svg>
                    )}
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {selected.length === 0 && <p className="text-xs text-red-500 mt-2 ml-1">{t("dash_no_platform")}</p>}
        </div>

        <div className="w-full max-w-2xl mt-10">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-500">{t("dash_recent")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(recentSearches.length > 0 ? recentSearches : EXAMPLE_SEARCHES).map((term) => (
              <button key={term} onClick={() => { setQuery(term); handleSearch(term); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-colors border ${
                  recentSearches.length > 0
                    ? "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                    : "bg-slate-50 border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600"
                }`}>
                <ShoppingCart className="w-3.5 h-3.5" />{term}
              </button>
            ))}
            <button onClick={() => setShowImageModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-600 hover:bg-blue-100 transition-colors">
              <Camera className="w-3.5 h-3.5" />{t("dash_camera_search")}
            </button>
          </div>
        </div>

        <div className="w-full max-w-2xl mt-12 grid grid-cols-3 gap-4">
          {[
            { label: t("dash_stat_platforms"), value: t("dash_stat_platforms_val") },
            { label: t("dash_stat_today"), value: todayCount === null ? "—" : String(todayCount) },
            { label: t("dash_stat_suspicious"), value: suspiciousCount === null ? "—" : String(suspiciousCount) },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
