"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock, TrendingUp, ShoppingCart, X, Camera, ImageIcon, Loader2, ShieldCheck, ShieldAlert, Flame, Wallet, Sparkles } from "lucide-react";
import { clsx } from "clsx";
import { Navbar } from "@/components/navbar";
import { ImageSearchModal } from "@/components/image-search-modal";
import { BaokuanGuideModal } from "@/components/baokuan-guide-modal";
import { CnLoginReminderModal } from "@/components/cn-login-reminder-modal";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { useSearchCooldown } from "@/lib/use-search-cooldown";
import { useCnSearchBudget, CN_DAILY_LIMIT } from "@/lib/use-cn-search-budget";

// China platforms carry the highest bot-detection / ban risk — searching any of
// them triggers a cooldown so the user can't rapid-fire searches at them.
const CN_PLATFORMS = ["taobao", "pinduoduo", "1688"];
const COOLDOWN_SEC = 45;

const PLATFORMS = [
  { id: "shopee",    label: "Shopee",  color: "border-orange-400 bg-orange-50 text-orange-700", group: "MY" },
  { id: "lazada",    label: "Lazada",  color: "border-blue-400 bg-blue-50 text-blue-700",       group: "MY" },
  { id: "taobao",    label: "淘宝",    color: "border-red-400 bg-red-50 text-red-700",           group: "CN" },
  { id: "pinduoduo", label: "拼多多",  color: "border-green-400 bg-green-50 text-green-700",     group: "CN" },
  { id: "1688",      label: "1688",    color: "border-amber-400 bg-amber-50 text-amber-700",     group: "CN" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { remaining, startCooldown } = useSearchCooldown(COOLDOWN_SEC);
  const { count: cnCount, bump: bumpCn, atLimit: cnAtLimit, warn: cnWarn } = useCnSearchBudget();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(["shopee", "lazada", "taobao", "pinduoduo", "1688"]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null); // search held while CN-login reminder is shown
  const [dropFile, setDropFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragIdentifying, setIsDragIdentifying] = useState(false);
  const dragCounter = useRef(0);
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
          const q = row.query?.trim() || "";
          // Skip raw JSON / garbage entries
          if (q.startsWith("{") || q.startsWith("`") || q.includes('"searchKeyword"') || q.length > 60) continue;
          if (!seen.has(q)) {
            seen.add(q);
            unique.push(q);
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

  // Actually fire the search (cooldown + daily counter + navigate)
  const doSearch = (searchQuery: string) => {
    if (selected.some((p) => CN_PLATFORMS.includes(p))) { startCooldown(); bumpCn(); }
    router.push(`/results?q=${encodeURIComponent(searchQuery.trim())}&platforms=${selected.join(",")}`);
  };

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim() || selected.length === 0) return;
    if (remaining > 0) return; // still cooling down — avoid rapid-fire searches
    const hitsCN = selected.some((p) => CN_PLATFORMS.includes(p));
    // Daily China-search ceiling reached → block to protect the account
    if (hitsCN && cnAtLimit) return;
    // First CN search this session → remind the user to log in to 淘宝/拼多多/1688
    // first (logged-in searches return far more results and dodge anti-bot walls).
    if (hitsCN && !sessionStorage.getItem("aao_cn_login_ack")) {
      setPendingQuery(searchQuery);
      return;
    }
    doSearch(searchQuery);
  };

  const handleImageIdentified = (productName: string) => {
    setQuery(productName);
    handleSearch(productName);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith("image/"));
    if (!file) return;
    setDropFile(file);
    setShowImageModal(true);
  }, []);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
          else { width = Math.round((width / height) * MAX); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });

  const FEATURES = [
    { icon: ShoppingCart, color: "text-blue-600 bg-blue-50",     title: t("feat_compare_title"),    desc: t("feat_compare_desc") },
    { icon: ShieldCheck,  color: "text-green-600 bg-green-50",   title: t("feat_auth_title"),       desc: t("feat_auth_desc") },
    { icon: Camera,       color: "text-purple-600 bg-purple-50", title: t("feat_photo_title"),      desc: t("feat_photo_desc") },
    { icon: Flame,        color: "text-orange-600 bg-orange-50", title: t("feat_bestseller_title"), desc: t("feat_bestseller_desc") },
    { icon: Wallet,       color: "text-rose-600 bg-rose-50",     title: t("feat_pricing_title"),    desc: t("feat_pricing_desc") },
    { icon: Sparkles,     color: "text-indigo-600 bg-indigo-50", title: t("feat_analysis_title"),   desc: t("feat_analysis_desc") },
  ];

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 relative"
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); } }}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {(isDragging || isDragIdentifying) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-blue-500/10 backdrop-blur-sm border-4 border-dashed border-blue-400 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4">
            {isDragIdentifying ? (
              <>
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <p className="text-xl font-bold text-slate-800">AI 正在识别产品…</p>
              </>
            ) : (
              <>
                <ImageIcon className="w-12 h-12 text-blue-500" />
                <p className="text-xl font-bold text-slate-800">松开以识别产品</p>
                <p className="text-sm text-slate-500">支持 JPG、PNG、WEBP 图片</p>
              </>
            )}
          </div>
        </div>
      )}

      <Navbar />

      {showImageModal && (
        <ImageSearchModal
          onClose={() => { setShowImageModal(false); setDropFile(null); }}
          onIdentified={handleImageIdentified}
          preloadedFile={dropFile}
        />
      )}

      {showGuide && <BaokuanGuideModal onClose={() => setShowGuide(false)} />}

      {pendingQuery !== null && (
        <CnLoginReminderModal
          onConfirm={() => {
            sessionStorage.setItem("aao_cn_login_ack", "1");
            const q = pendingQuery;
            setPendingQuery(null);
            doSearch(q);
          }}
          onClose={() => setPendingQuery(null)}
        />
      )}

      <main className="flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1.5 rounded-full border border-blue-200 mb-4">
            <TrendingUp className="w-4 h-4" />
            {t("dash_badge")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-3">{t("dash_title")}</h1>
          <p className="text-slate-500 text-base max-w-md">{t("dash_subtitle")}</p>
          <div className="mt-4">
            <button onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-4 py-2 rounded-full transition-colors">
              🔥 {t("dash_guide_btn")}
            </button>
          </div>
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
            <button onClick={() => { setDropFile(null); setShowImageModal(true); }} title={t("img_title")}
              className="self-center w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <Camera className="w-5 h-5" />
            </button>
            <button onClick={() => handleSearch()} disabled={!query.trim() || selected.length === 0 || remaining > 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm shrink-0 min-w-[68px]">
              {remaining > 0 ? (lang === "zh" ? `冷却 ${remaining}s` : `${remaining}s`) : t("dash_search_btn")}
            </button>
          </div>

          {remaining > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === "zh"
                ? `刚搜过中国平台，等 ${remaining} 秒再搜更安全（避免被平台当机器人）`
                : `Just searched China platforms — wait ${remaining}s before searching again (avoids bot flags)`}</span>
            </div>
          )}

          {/* Daily China-search budget — protects a heavy user from a ban */}
          {cnAtLimit ? (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{lang === "zh"
                ? `今天中国平台已搜 ${cnCount} 次，达到安全上限（${CN_DAILY_LIMIT}）。为保护账号，请明天再搜，或先只用马来平台（Shopee/Lazada 不受限）。`
                : `${cnCount} China-platform searches today — daily safety limit (${CN_DAILY_LIMIT}) reached. Protect your account: continue tomorrow, or use MY platforms only (Shopee/Lazada aren't limited).`}</span>
            </div>
          ) : cnCount > 0 && (
            <div className={clsx("mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg",
              cnWarn ? "text-amber-700 bg-amber-50 border border-amber-200" : "text-slate-400")}>
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === "zh"
                ? `今日中国平台搜索 ${cnCount}/${CN_DAILY_LIMIT}${cnWarn ? " · 接近上限，注意别太频繁" : ""}`
                : `China searches today ${cnCount}/${CN_DAILY_LIMIT}${cnWarn ? " · nearing the limit, ease off" : ""}`}</span>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <span className="text-sm text-slate-500">{t("dash_platform_label")}</span>
            <div className="flex flex-col gap-2">
              {["MY", "CN"].map(group => (
                <div key={group} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 w-12 shrink-0">{group === "MY" ? "🇲🇾 MY" : "🇨🇳 CN"}</span>
                  {PLATFORMS.filter(p => p.group === group).map((p) => (
                    <button key={p.id} onClick={() => togglePlatform(p.id)}
                      className={clsx("flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 text-sm font-medium transition-all",
                        selected.includes(p.id) ? p.color : "border-slate-200 bg-white text-slate-400")}>
                      <span className={clsx("w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
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
              <button key={term} onClick={() => { setQuery(term); handleSearch(term); }} disabled={remaining > 0}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-colors border disabled:opacity-40 disabled:cursor-not-allowed ${
                  recentSearches.length > 0
                    ? "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                    : "bg-slate-50 border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600"
                }`}>
                <ShoppingCart className="w-3.5 h-3.5" />{term}
              </button>
            ))}
            <button onClick={() => { setDropFile(null); setShowImageModal(true); }}
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

        {/* Feature overview — so users see everything the system can do */}
        <div className="w-full max-w-4xl mt-16">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-700">{t("dash_features_title")}</h2>
            <p className="text-sm text-slate-400 mt-1">{t("dash_features_hint")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4 hover:border-slate-300 hover:shadow-sm transition-all">
                  <div className={clsx("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", f.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm mb-1">{f.title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
