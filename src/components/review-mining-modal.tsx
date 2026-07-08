"use client";

import { useState } from "react";
import { X, Lightbulb, Loader2, AlertTriangle, ThumbsDown, Wrench, Megaphone } from "lucide-react";
import { clsx } from "clsx";
import { useLanguage } from "@/lib/i18n";

interface Complaint { issue: string; detail?: string; severity?: string }
interface MiningResult {
  source?: string;
  complaints?: Complaint[];
  improvements?: string[];
  sellingPoints?: string[];
  summary?: string;
}

export function ReviewMiningModal({ productName, onClose }: { productName: string; onClose: () => void }) {
  const { lang } = useLanguage();
  const zh = lang === "zh";
  const [reviews, setReviews] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MiningResult | null>(null);
  const [grounded, setGrounded] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/mine-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, reviews }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || (zh ? "分析失败" : "Failed")); return; }
      setResult(data.analysis);
      setGrounded(!!data.grounded);
    } catch {
      setError(zh ? "网络错误，请重试" : "Network error, retry");
    } finally {
      setLoading(false);
    }
  };

  const sevCls = (s?: string) => s === "高" ? "bg-red-100 text-red-700" : s === "中" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="relative px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-slate-800 text-base">{zh ? "改良机会分析" : "Improvement Opportunities"}</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{productName}</p>
          <button onClick={onClose} className="absolute top-3.5 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!result && (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                {zh ? "找出买家在骂什么 → 你进一个「改良版」赢过原爆款。" : "Find what buyers complain about → source an improved version that beats the bestseller."}
              </p>
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
                  {zh ? "贴上真实差评（可选，越准越好）" : "Paste real reviews (optional, more accurate)"}
                </label>
                <textarea value={reviews} onChange={(e) => setReviews(e.target.value)} rows={5}
                  placeholder={zh ? "从商品页复制几条评价贴这里；留空则用品类经验推断常见痛点。" : "Copy a few reviews from the listing; leave blank to infer common pain points by category."}
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <button onClick={run} disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{zh ? "分析中…" : "Analyzing…"}</> : <><Lightbulb className="w-4 h-4" />{zh ? "分析改良机会" : "Analyze"}</>}
              </button>
            </>
          )}

          {result && (
            <>
              <div className={clsx("text-xs rounded-lg px-3 py-2 border flex items-start gap-1.5",
                grounded ? "text-green-700 bg-green-50 border-green-200" : "text-amber-700 bg-amber-50 border-amber-200")}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{grounded ? (zh ? "基于你提供的真实评价" : "Based on the reviews you pasted") : (zh ? "基于品类常见痛点推断（非真实评价）—— 请对照真实评价核实" : "Inferred from category pain points (not real reviews) — verify against actual reviews")}</span>
              </div>

              {result.summary && <p className="text-sm font-medium text-slate-800">{result.summary}</p>}

              {result.complaints && result.complaints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><ThumbsDown className="w-3.5 h-3.5" />{zh ? "买家抱怨点" : "Complaints"}</p>
                  <div className="space-y-2">
                    {result.complaints.map((c, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{c.issue}</span>
                          {c.severity && <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full font-semibold", sevCls(c.severity))}>{c.severity}</span>}
                        </div>
                        {c.detail && <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.improvements && result.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" />{zh ? "改良建议" : "Improvements"}</p>
                  <ul className="space-y-1.5">
                    {result.improvements.map((s, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-green-500 shrink-0">✓</span>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.sellingPoints && result.sellingPoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5" />{zh ? "可主打卖点" : "Selling points"}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.sellingPoints.map((s, i) => (
                      <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setResult(null)} className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 rounded-xl text-sm transition-colors">
                {zh ? "重新分析" : "Analyze again"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
