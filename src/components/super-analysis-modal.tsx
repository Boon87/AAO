"use client";

import { useState } from "react";
import { X, Loader2, Shield, TrendingUp, DollarSign, AlertTriangle, Zap, BarChart2, Target, Package, Clock, Award, Download, ExternalLink } from "lucide-react";

interface Product {
  name: string; price: number; sales: number; reviews: number;
  rating: number; shopName: string; shopAge: number; platform: string;
  imageUrl?: string; url?: string;
}

interface SuperAnalysisModalProps {
  product: Product;
  marketAvgPrice: number;
  allPrices: number[];
  onClose: () => void;
}

const GRADE_CONFIG: Record<string, { color: string; bg: string; border: string; emoji: string }> = {
  S: { color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-300", emoji: "🔥" },
  A: { color: "text-green-700",  bg: "bg-green-50",  border: "border-green-300",  emoji: "✅" },
  B: { color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-300",   emoji: "✅" },
  C: { color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300", emoji: "⚠️" },
  D: { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300", emoji: "⚠️" },
  E: { color: "text-red-700",    bg: "bg-red-50",    border: "border-red-300",    emoji: "🚨" },
};

const RISK_CONFIG: Record<string, { color: string; bg: string }> = {
  A: { color: "text-green-700",  bg: "bg-green-100"  },
  B: { color: "text-blue-700",   bg: "bg-blue-100"   },
  C: { color: "text-yellow-700", bg: "bg-yellow-100" },
  D: { color: "text-orange-700", bg: "bg-orange-100" },
  E: { color: "text-red-700",    bg: "bg-red-100"    },
};

function ScoreBar({ score, color = "bg-blue-500" }: { score: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-8 text-right">{score}</span>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "rising")   return <span className="text-green-600 font-bold">📈 上升</span>;
  if (trend === "declining") return <span className="text-red-600 font-bold">📉 下降</span>;
  return <span className="text-slate-500">➡️ 持平</span>;
}

function Stars({ count }: { count: number }) {
  return <span>{Array.from({ length: 5 }).map((_, i) => <span key={i} className={i < count ? "text-yellow-400" : "text-slate-200"}>★</span>)}</span>;
}

export function SuperAnalysisModal({ product, marketAvgPrice, allPrices, onClose }: SuperAnalysisModalProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  const startAnalysis = async () => {
    setStarted(true);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/super-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, marketAvgPrice, allPrices }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败，请重试");
    }
    setLoading(false);
  };

  const a = analysis as Record<string, Record<string, unknown>> | null;

  const exportPDF = () => {
    const grade = (a?.layer10_decision as Record<string, unknown>)?.grade as string || "?";
    const score = (a?.layer10_decision as Record<string, unknown>)?.total_score as number || 0;
    const summary = (a?.layer10_decision as Record<string, unknown>)?.summary as string || "";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>AI Super Buyer 报告 — ${product.name}</title>
<style>
  body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1e293b; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #64748b; font-size: 13px; margin-bottom: 20px; }
  .grade { display: inline-block; font-size: 48px; font-weight: 900; padding: 8px 24px; border-radius: 12px; background: #f1f5f9; margin-bottom: 16px; }
  .summary { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: left; background: #1e293b; color: white; padding: 10px 12px; font-size: 13px; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
  img.product-img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .green { background: #dcfce7; color: #166534; }
  .red { background: #fee2e2; color: #991b1b; }
  @media print { button { display: none; } }
</style>
</head><body>
<div class="header">
  ${product.imageUrl ? `<img class="product-img" src="${product.imageUrl}" crossorigin="anonymous" />` : ""}
  <div>
    <h1>AI SUPER BUYER V2.0 分析报告</h1>
    <div class="sub">${product.name} &nbsp;|&nbsp; ${product.platform.toUpperCase()} &nbsp;|&nbsp; RM ${product.price} &nbsp;|&nbsp; 生成时间: ${new Date().toLocaleString("zh-MY")}</div>
  </div>
</div>
<div class="grade">${grade}级 — ${score}/100分</div>
<div class="summary">${summary}</div>
<table>
  <tr><th colspan="2">产品基本信息</th></tr>
  <tr><td>商品名称</td><td>${product.name}</td></tr>
  <tr><td>平台</td><td>${product.platform}</td></tr>
  <tr><td>售价</td><td>RM ${product.price}</td></tr>
  <tr><td>销量</td><td>${product.sales}</td></tr>
  <tr><td>评价数</td><td>${product.reviews}</td></tr>
  <tr><td>评分</td><td>${product.rating}/5</td></tr>
  <tr><td>店铺</td><td>${product.shopName}（开店 ${product.shopAge} 个月）</td></tr>
  <tr><td>市场均价</td><td>RM ${marketAvgPrice}</td></tr>
</table>
<table>
  <tr><th>分析层级</th><th>评分</th><th>关键信息</th></tr>
  <tr><td>真实性</td><td>${(a?.layer1_authenticity as Record<string,unknown>)?.score ?? "—"}</td><td>图片风险: ${(a?.layer1_authenticity as Record<string,unknown>)?.image_risk ?? "—"}</td></tr>
  <tr><td>价格分析</td><td>${(a?.layer2_pricing as Record<string,unknown>)?.score ?? "—"}</td><td>${(a?.layer2_pricing as Record<string,unknown>)?.price_assessment ?? "—"}</td></tr>
  <tr><td>供应商</td><td>${(a?.layer3_supplier as Record<string,unknown>)?.score ?? "—"}</td><td>${(a?.layer3_supplier as Record<string,unknown>)?.shop_type ?? "—"}</td></tr>
  <tr><td>诈骗风险</td><td>${(a?.layer4_fraud_risk as Record<string,unknown>)?.risk_level ?? "—"}级</td><td>${(a?.layer4_fraud_risk as Record<string,unknown>)?.risk_label ?? "—"}</td></tr>
  <tr><td>爆款潜力</td><td>${(a?.layer5_viral_potential as Record<string,unknown>)?.score ?? "—"}</td><td>需求: ${(a?.layer5_viral_potential as Record<string,unknown>)?.demand_level ?? "—"}</td></tr>
  <tr><td>竞争分析</td><td>难度 ${(a?.layer6_competition as Record<string,unknown>)?.entry_difficulty ?? "—"}/5</td><td>饱和度: ${(a?.layer6_competition as Record<string,unknown>)?.market_saturation ?? "—"}</td></tr>
  <tr><td>利润分析</td><td>${(a?.layer7_profit as Record<string,unknown>)?.profit_assessment ?? "—"}</td><td>净利率: ${(a?.layer7_profit as Record<string,unknown>)?.estimated_net_margin_pct ?? "—"}%，ROI: ${(a?.layer7_profit as Record<string,unknown>)?.estimated_roi_pct ?? "—"}%</td></tr>
  <tr><td>OEM/ODM</td><td>${(a?.layer8_oem_odm as Record<string,unknown>)?.score ?? "—"}</td><td>品牌潜力: ${(a?.layer8_oem_odm as Record<string,unknown>)?.brand_potential ?? "—"}</td></tr>
  <tr><td>趋势预测</td><td>—</td><td>3月: ${(a?.layer9_trend as Record<string,unknown>)?.["3_months"] ?? "—"} / 6月: ${(a?.layer9_trend as Record<string,unknown>)?.["6_months"] ?? "—"} / 12月: ${(a?.layer9_trend as Record<string,unknown>)?.["12_months"] ?? "—"}</td></tr>
</table>
${(() => {
  const c = a?.supplier_credibility as Record<string,unknown>;
  if (!c) return "";
  const rows = [
    ["公司真实性", "company_authenticity", 20],
    ["经营历史", "business_history", 15],
    ["网络信誉", "online_reputation", 20],
    ["产品真实性", "product_authenticity", 15],
    ["商业诚信", "business_integrity", 15],
    ["诈骗风险评分", "fraud_risk_deductions", 15],
  ] as [string, string, number][];
  return `<table>
  <tr><th colspan="3">商家信誉审核报告 — 等级: ${c.grade ?? "?"} (${c.total ?? 0}/100分)</th></tr>
  <tr><th>评分项目</th><th>得分</th><th>备注</th></tr>
  ${rows.map(([label, key, max]) => {
    const item = c[key] as Record<string,unknown> || {};
    const flags = (item.deducted_flags as string[] || []).join(", ");
    return `<tr><td>${label} (满分${max})</td><td>${item.score ?? "—"}/${max}</td><td>${item.notes ?? ""}${flags ? " ⚠ " + flags : ""}</td></tr>`;
  }).join("")}
  <tr><td colspan="2"><strong>结论</strong></td><td><strong>${c.conclusion ?? ""}</strong>: ${c.conclusion_detail ?? ""}</td></tr>
</table>`;
})()}
<p style="color:#94a3b8;font-size:11px;margin-top:32px;">由 AAO 竞品分析工具 AI SUPER BUYER V2.0 生成 · ${new Date().toLocaleDateString("zh-MY")}</p>
<script>window.onload = () => window.print();</script>
</body></html>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            {product.imageUrl && (
              <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/20 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-yellow-400" />
                <span className="font-bold text-white text-base">AI SUPER BUYER V2.0</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{product.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {a && (
              <button onClick={exportPDF} title="导出 PDF 报告"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-yellow-400 transition-colors">
                <Download className="w-4 h-4" />
              </button>
            )}
            {product.url && product.url !== "#" && (
              <a href={product.url} target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-300 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition-colors">
              <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">

          {/* Not started yet */}
          {!started && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">10层深度尽职调查</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">AI 将从产品真实性、价格、供应商可信度、诈骗风险、爆款潜力等10个维度全面分析这个产品</p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full text-xs text-slate-600">
                {["产品真实性审核", "市场价格分析", "供应商审核", "诈骗风险检测", "爆款潜力评估", "竞争分析", "利润空间计算", "OEM/ODM潜力", "未来趋势预测", "最终投资决策"].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center justify-center font-bold shrink-0">{i+1}</span>
                    {item}
                  </div>
                ))}
              </div>
              <button onClick={startAnalysis}
                className="w-full bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-yellow-400" />开始深度分析
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <p className="font-semibold text-slate-800">AI 正在进行10层深度分析…</p>
              <p className="text-sm text-slate-500">通常需要 10-20 秒</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-600 font-medium">{error}</p>
              <button onClick={startAnalysis} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm">重试</button>
            </div>
          )}

          {/* Results */}
          {a && !loading && (
            <div className="space-y-5">

              {/* Grade card */}
              {(() => {
                const d = a.layer10_decision as Record<string, unknown>;
                const grade = d?.grade as string || "C";
                const cfg = GRADE_CONFIG[grade] || GRADE_CONFIG.C;
                return (
                  <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} p-5`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl font-black {cfg.color}">{cfg.emoji} {grade}级</span>
                        <div>
                          <p className={`font-bold text-lg ${cfg.color}`}>{d?.grade_label as string}</p>
                          <p className="text-xs text-slate-500">总评分 {d?.total_score as number}/100</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-5xl font-black ${cfg.color}`}>{d?.total_score as number}</div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{d?.summary as string}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {(d?.top_opportunities as string[] || []).map((o, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-green-700">
                          <span className="text-green-500 shrink-0">✓</span>{o}
                        </div>
                      ))}
                      {(d?.top_risks as string[] || []).map((r, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                          <span className="text-red-500 shrink-0">!</span>{r}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Score radar */}
              {(() => {
                const scores = (a.layer10_decision as Record<string, unknown>)?.scores as Record<string, number> || {};
                const items = [
                  { label: "产品真实性", key: "product_authenticity", icon: <Shield className="w-3.5 h-3.5" />, color: "bg-blue-500" },
                  { label: "市场价格", key: "market_price", icon: <DollarSign className="w-3.5 h-3.5" />, color: "bg-green-500" },
                  { label: "供应商可信", key: "supplier_trust", icon: <Award className="w-3.5 h-3.5" />, color: "bg-purple-500" },
                  { label: "诈骗风险", key: "fraud_risk", icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "bg-red-500" },
                  { label: "利润空间", key: "profit_potential", icon: <TrendingUp className="w-3.5 h-3.5" />, color: "bg-emerald-500" },
                  { label: "爆款潜力", key: "viral_potential", icon: <Zap className="w-3.5 h-3.5" />, color: "bg-yellow-500" },
                  { label: "品牌潜力", key: "brand_potential", icon: <Package className="w-3.5 h-3.5" />, color: "bg-pink-500" },
                  { label: "趋势评分", key: "trend_score", icon: <BarChart2 className="w-3.5 h-3.5" />, color: "bg-orange-500" },
                ];
                return (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">各项评分</h4>
                    <div className="space-y-2">
                      {items.map(item => (
                        <div key={item.key} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 w-24 shrink-0 text-slate-600 text-xs">{item.icon}{item.label}</div>
                          <ScoreBar score={scores[item.key] ?? 50} color={item.color} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Layer 4: Fraud */}
              {(() => {
                const d = a.layer4_fraud_risk as Record<string, unknown>;
                const level = d?.risk_level as string || "C";
                const cfg = RISK_CONFIG[level] || RISK_CONFIG.C;
                return (
                  <div className={`rounded-xl p-4 ${cfg.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-4 h-4 ${cfg.color}`} />
                        <span className={`font-bold text-sm ${cfg.color}`}>第4层：诈骗风险审核</span>
                      </div>
                      <span className={`font-black text-lg ${cfg.color}`}>{level}级 — {d?.risk_label as string}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {(d?.detected_patterns as string[] || []).map((p, i) => (
                        <div key={i} className="text-xs text-red-700 flex gap-1"><span>⚠</span>{p}</div>
                      ))}
                      {(d?.safe_signals as string[] || []).map((s, i) => (
                        <div key={i} className="text-xs text-green-700 flex gap-1"><span>✓</span>{s}</div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Layer 2: Pricing */}
              {(() => {
                const d = a.layer2_pricing as Record<string, unknown>;
                return (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="font-bold text-sm text-slate-700">第2层：市场价格分析</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{d?.price_assessment as string}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center mb-3">
                      {[["采购建议价", d?.suggested_purchase_price], ["批发建议价", d?.suggested_wholesale_price], ["零售建议价", d?.suggested_retail_price]].map(([label, val]) => (
                        <div key={label as string} className="bg-white rounded-lg p-2 border border-slate-100">
                          <p className="text-xs text-slate-500">{label as string}</p>
                          <p className="font-bold text-slate-800">RM {Number(val).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">{d?.notes as string}</p>
                  </div>
                );
              })()}

              {/* Layer 7: Profit */}
              {(() => {
                const d = a.layer7_profit as Record<string, unknown>;
                return (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-sm text-slate-700">第7层：利润分析</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{d?.profit_assessment as string}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[["毛利率", `${d?.estimated_gross_margin_pct}%`], ["净利率", `${d?.estimated_net_margin_pct}%`], ["ROI", `${d?.estimated_roi_pct}%`], ["回本", `${d?.payback_months}月`]].map(([label, val]) => (
                        <div key={label as string} className="bg-white rounded-lg p-2 border border-slate-100">
                          <p className="text-xs text-slate-500">{label as string}</p>
                          <p className="font-bold text-emerald-700 text-sm">{val as string}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Layer 5: Viral + Layer 9: Trend */}
              <div className="grid grid-cols-2 gap-4">
                {(() => {
                  const d = a.layer5_viral_potential as Record<string, unknown>;
                  return (
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="font-bold text-xs text-slate-700">爆款潜力</span>
                      </div>
                      <div className="text-3xl font-black text-yellow-500 mb-2">{d?.score as number}<span className="text-sm text-slate-400">/100</span></div>
                      <div className="space-y-1 text-xs">
                        {[["解决痛点", d?.pain_point_solved], ["冲动消费", d?.impulse_buy], ["刚需产品", d?.essential_product], ["视频传播", d?.video_friendly]].map(([label, val]) => (
                          <div key={label as string} className="flex justify-between">
                            <span className="text-slate-500">{label as string}</span>
                            <span className={val ? "text-green-600" : "text-slate-300"}>{val ? "✓" : "✗"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const d = a.layer9_trend as Record<string, unknown>;
                  return (
                    <div className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart2 className="w-4 h-4 text-blue-500" />
                        <span className="font-bold text-xs text-slate-700">趋势预测</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {[["3个月", d?.["3_months"]], ["6个月", d?.["6_months"]], ["12个月", d?.["12_months"]]].map(([label, val]) => (
                          <div key={label as string} className="flex justify-between items-center">
                            <span className="text-slate-500">{label as string}</span>
                            <TrendIcon trend={val as string} />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">{d?.seasonality as string}</p>
                    </div>
                  );
                })()}
              </div>

              {/* Layer 6: Competition */}
              {(() => {
                const d = a.layer6_competition as Record<string, unknown>;
                return (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-purple-600" />
                        <span className="font-bold text-sm text-slate-700">第6层：竞争分析</span>
                      </div>
                      <div><Stars count={d?.entry_difficulty as number || 3} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {[["市场饱和", d?.market_saturation], ["价格战", d?.price_war_risk], ["竞争者", d?.competitor_count_estimate]].map(([label, val]) => (
                        <div key={label as string} className="bg-white rounded-lg p-2 border border-slate-100">
                          <p className="text-slate-500">{label as string}</p>
                          <p className="font-semibold text-slate-700 capitalize">{val as string}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{d?.notes as string}</p>
                  </div>
                );
              })()}

              {/* Layer 8: OEM */}
              {(() => {
                const d = a.layer8_oem_odm as Record<string, unknown>;
                return (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-pink-600" />
                      <span className="font-bold text-sm text-slate-700">第8层：OEM/ODM 潜力</span>
                      <span className="ml-auto font-bold text-pink-600">{d?.score as number}/100</span>
                    </div>
                    <div className="flex gap-4 text-xs mb-2">
                      <span className={d?.white_label_suitable ? "text-green-600" : "text-slate-300"}>✓ 白牌适合</span>
                      <span className={d?.private_label_suitable ? "text-green-600" : "text-slate-300"}>✓ 贴牌适合</span>
                      <span className="text-slate-600">品牌潜力: <strong>{d?.brand_potential as string}</strong></span>
                    </div>
                    <p className="text-xs text-slate-500">{d?.notes as string}</p>
                  </div>
                );
              })()}

              {/* Supplier */}
              {(() => {
                const d = a.layer3_supplier as Record<string, unknown>;
                return (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="font-bold text-sm text-slate-700">第3层：供应商审核</span>
                      <span className="ml-auto font-bold text-slate-600">{d?.score as number}/100</span>
                    </div>
                    <div className="flex gap-4 text-xs mb-2">
                      <span className="text-slate-600">类型: <strong>{d?.shop_type as string}</strong></span>
                      <span className="text-slate-600">店龄: <strong>{d?.shop_age_months as number}月</strong></span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {(d?.green_flags as string[] || []).map((f, i) => <div key={i} className="text-green-700">✓ {f}</div>)}
                      {(d?.red_flags as string[] || []).map((f, i) => <div key={i} className="text-red-700">⚠ {f}</div>)}
                    </div>
                  </div>
                );
              })()}

              {/* Supplier Credibility Report */}
              {(() => {
                const c = a.supplier_credibility as Record<string, unknown>;
                if (!c) return null;
                const grade = c.grade as string || "C";
                const total = c.total as number || 0;
                const conclusion = c.conclusion as string || "";
                const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
                  "A+": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
                  "A":  { bg: "bg-green-50",   text: "text-green-700",   border: "border-green-300"   },
                  "B":  { bg: "bg-blue-50",     text: "text-blue-700",   border: "border-blue-300"    },
                  "C":  { bg: "bg-yellow-50",   text: "text-yellow-700", border: "border-yellow-300"  },
                  "D":  { bg: "bg-orange-50",   text: "text-orange-700", border: "border-orange-300"  },
                  "E":  { bg: "bg-red-50",      text: "text-red-700",    border: "border-red-300"     },
                };
                const gc = gradeColors[grade] || gradeColors["C"];
                const conclusionIcon = conclusion.includes("值得合作") ? "✅" : conclusion.includes("高风险") ? "🚨" : "⚠️";
                const rows = [
                  { label: "公司真实性", key: "company_authenticity", max: 20 },
                  { label: "经营历史",   key: "business_history",     max: 15 },
                  { label: "网络信誉",   key: "online_reputation",    max: 20 },
                  { label: "产品真实性", key: "product_authenticity", max: 15 },
                  { label: "商业诚信",   key: "business_integrity",   max: 15 },
                  { label: "诈骗风险",   key: "fraud_risk_deductions", max: 15 },
                ];
                return (
                  <div className={`rounded-xl border-2 ${gc.border} ${gc.bg} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className={`w-4 h-4 ${gc.text}`} />
                        <span className={`font-bold text-sm ${gc.text}`}>商家信誉审核报告</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-black ${gc.text}`}>{grade}</span>
                        <span className="text-xs text-slate-500">{total}/100分</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      {rows.map(row => {
                        const item = c[row.key] as Record<string, unknown> || {};
                        const score = item.score as number ?? 0;
                        const pct = Math.round((score / row.max) * 100);
                        const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
                        return (
                          <div key={row.key}>
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span className="text-slate-600">{row.label}</span>
                              <span className="font-bold text-slate-700">{score}/{row.max}</span>
                            </div>
                            <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            {(item.deducted_flags as string[] || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(item.deducted_flags as string[]).map((f, i) => (
                                  <span key={i} className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">⚠ {f}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-white/50 pt-3">
                      <p className="font-bold text-sm mb-1">{conclusionIcon} {conclusion}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{c.conclusion_detail as string}</p>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
