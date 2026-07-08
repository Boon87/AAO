"use client";

import { X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

// In-app "how to find bestsellers" guide. Content mirrors the printable
// cheat-sheet. Kept bilingual inline (rather than in the global i18n dict)
// because it's a single self-contained help document.
export function BaokuanGuideModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLanguage();
  const zh = lang === "zh";

  const steps = [
    {
      n: 1,
      title: zh ? "带一个品类进去搜" : "Search a category",
      body: zh
        ? "首页输入关键词（例：保温杯、收纳盒），或用拍照 / 图片找同款。系统不会凭空推荐品类 —— 你给方向，它在这个品类里帮你排出最有爆款相的具体产品。"
        : "Enter a keyword (e.g. thermos, storage box) or use photo / image search. The tool doesn't invent categories — you give the direction, it ranks the most promising products within it.",
    },
    {
      n: 2,
      key: true,
      title: zh ? "5 个平台全部勾上 —— 最关键" : "Tick all 5 platforms — most important",
      body: zh ? "缺一边就算不出利润：" : "Miss one side and margin can't be computed:",
    },
    {
      n: 3,
      title: zh ? "看「🔥 爆款潜力榜」" : "Read the 🔥 Bestseller board",
      body: zh
        ? "搜完在结果页顶部会自动出现橙色榜单，已经帮你排好名。想重排整页，也可以用 排序 → 🔥 爆款潜力。"
        : "After searching, an orange board appears at the top of the results — already ranked. You can also reorder the whole page with Sort → 🔥 Bestseller.",
    },
    {
      n: 4,
      title: zh ? "点进产品对比，深入看" : "Open compare for the deep dive",
      body: zh
        ? "挑中意的进对比页：看成本 + 利润定价（进货价 → 建议售价 / 利润 / 利润率）和 AI 深度分析，再决定要不要做。"
        : "Open the compare page for cost + margin pricing (cost → suggested price / profit / margin) and AI deep analysis, then decide.",
    },
  ];

  const metrics = [
    { cls: "text-orange-600", t: zh ? "🔥 爆款分" : "🔥 Score", d: zh ? "综合分，越高越值得做，直接看它排名。" : "Overall score — higher is better; just read the ranking." },
    { cls: "text-green-600", t: zh ? "需求热度 /100" : "Demand /100", d: zh ? "卖得火不火：评价数 + 收藏数 + 评分。" : "How well it sells: reviews + favorites + rating." },
    { cls: "text-blue-600", t: zh ? "利润空间 RM" : "Margin RM", d: zh ? "能赚多少：马来售价 − 最便宜中国进货价。" : "Profit: MY price − cheapest China source." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="relative px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-orange-600">🔥 {zh ? "商家选品" : "Merchant picks"}</div>
          <h2 className="font-bold text-slate-800 text-lg mt-0.5">{zh ? "怎么找爆款" : "How to Find Bestsellers"}</h2>
          <button onClick={onClose} className="absolute top-3.5 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((s) => (
              <div key={s.n} className="grid grid-cols-[40px_1fr] gap-3.5 items-start">
                <div className={`w-10 h-10 rounded-full grid place-items-center text-lg font-extrabold tabular-nums border ${
                  s.key ? "bg-orange-500 text-white border-transparent" : "bg-blue-50 text-blue-600 border-blue-200"}`}>
                  {s.n}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px] mt-1">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mt-1.5">{s.body}</p>

                  {/* Step 2 detail: two-sided why + platform chips */}
                  {s.key && (
                    <div className="mt-2.5 bg-orange-50 border border-orange-200 rounded-xl p-3.5">
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        <p className="text-[13px] leading-snug text-slate-600">
                          <span className="font-extrabold text-blue-600">🇲🇾 {zh ? "马来平台" : "MY"}</span><br />
                          {zh ? "Shopee / Lazada — 看卖得好不好 + 卖多少钱" : "Shopee / Lazada — how well it sells + price"}
                        </p>
                        <p className="text-[13px] leading-snug text-slate-600">
                          <span className="font-extrabold text-orange-600">🇨🇳 {zh ? "中国平台" : "CN"}</span><br />
                          {zh ? "淘宝 / 拼多多 / 1688 — 看进货成本多低" : "Taobao / PDD / 1688 — how cheap to source"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {["Shopee", "Lazada", "淘宝", "拼多多", "1688"].map((p) => (
                          <span key={p} className="text-xs px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-500 font-semibold">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Scoring */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">{zh ? "评分标准 · 它以什么算爆款" : "How the score works"}</div>
            <p className="font-extrabold text-slate-800 mt-2 leading-snug text-[15px]">
              <span className="text-green-600">{zh ? "需求（卖得好）60%" : "Demand 60%"}</span>
              <span className="text-slate-400 mx-1.5">＋</span>
              <span className="text-orange-600">{zh ? "利润空间（赚得多）40%" : "Margin 40%"}</span>
            </p>
            <p className="text-sm text-slate-500 mt-1.5">
              {zh ? "在马来卖得火 ＋ 能从中国便宜进货 ＝ 最值得做的品。" : "Sells well in MY + cheap to source from China = worth doing."}
            </p>
            <div className="grid sm:grid-cols-3 gap-2.5 mt-3.5">
              {metrics.map((m) => (
                <div key={m.t} className="bg-white border border-slate-200 rounded-xl p-3">
                  <p className={`font-extrabold text-[14px] ${m.cls}`}>{m.t}</p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">{m.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Safety */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 grid grid-cols-[auto_1fr] gap-3.5 items-start">
            <span className="text-2xl leading-none">🛡️</span>
            <div>
              <p className="font-extrabold text-amber-800">{zh ? "防封号 · 别把平台惹毛" : "Avoid bans"}</p>
              <p className="text-sm text-slate-600 leading-relaxed mt-1">
                {zh ? "搜过中国平台后，搜索按钮会自动冷却倒数 " : "After searching China platforms, the button shows a cooldown "}
                <span className="inline-flex items-center gap-1 font-mono font-bold text-[12px] text-amber-800 bg-amber-200/50 px-1.5 py-0.5 rounded tabular-nums">⏱ {zh ? "冷却 45s" : "45s"}</span>
                {zh ? " —— 等它归零再搜。系统还有每日中国平台搜索上限（50 次），到顶会拦下来保护账号。" : " — wait for it. There's also a daily China-search cap (50) that blocks further searches to protect your account."}
              </p>
              <p className="text-sm text-slate-600 leading-relaxed mt-2">
                {zh ? "🔑 最关键的三件事：① 用养熟的老号（别用新号/小号）；② 一天别搜太多、别连珠炮；③ 弹出验证就自己慢慢过，别烦躁猛点。" : "🔑 Three habits that matter most: (1) use an aged account, not a fresh one; (2) don't search too many per day or in bursts; (3) if a captcha appears, complete it calmly yourself."}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
            {zh ? "知道了，开始找爆款" : "Got it, start searching"}
          </button>
        </div>
      </div>
    </div>
  );
}
