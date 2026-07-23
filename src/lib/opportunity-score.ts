// Feature 5: local opportunity score for watchlist candidates.
// Deterministic, computed only from snapshots we already store — no AI call,
// no extra scraping, zero ban risk. The score gets MORE trustworthy with each
// re-check (more snapshots = real momentum data instead of a neutral guess).

export interface ScorePart {
  key: "demand" | "momentum" | "price" | "rating" | "confidence";
  score: number;
  max: number;
}

export interface OpportunityScore {
  total: number; // 0-100
  grade: "A" | "B" | "C" | "D";
  parts: ScorePart[];
  singleSnapshot: boolean; // true = momentum/price are neutral guesses, re-check to firm up
}

interface SnapLike {
  price: number;
  reviews: number;
  likes: number;
  rating: number;
  saved_at: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// 需求热度 (max 30): proven demand from the latest review count, log scale so
// 10 reviews ≈ 10pts, 100 ≈ 20pts, 1000+ ≈ 30pts.
function demandScore(reviews: number): number {
  if (reviews <= 0) return 0;
  return clamp(Math.round(10 * Math.log10(reviews + 1)), 0, 30);
}

// 上升动能 (max 30): review growth since first saved, relative to where it
// started. A small shop gaining fast beats a giant gaining slowly.
function momentumScore(first: SnapLike, latest: SnapLike, single: boolean): number {
  if (single) return 10; // unknown — neutral-low until a re-check
  const dReviews = (latest.reviews || 0) - (first.reviews || 0);
  const rel = Math.max(0, dReviews) / Math.max(first.reviews || 0, 10);
  const likesBonus = (latest.likes || 0) > (first.likes || 0) ? 3 : 0;
  return clamp(8 + Math.round(rel * 44) + likesBonus, 0, 30);
}

// 价格走势 (max 15): price holding or rising = market supports the margin;
// falling >5% = price-war warning.
function priceScore(first: SnapLike, latest: SnapLike, single: boolean): number {
  if (single) return 8;
  const fp = first.price || 0;
  if (fp <= 0) return 8;
  const relPct = ((latest.price || 0) - fp) / fp;
  if (relPct > 0.05) return 12;
  if (relPct < -0.05) return 4;
  return 9;
}

// 口碑 (max 15): rating tiers; unknown sits neutral so missing data neither
// helps nor sinks a candidate.
function ratingScore(rating: number): number {
  if (!rating || rating <= 0) return 6;
  if (rating >= 4.8) return 15;
  if (rating >= 4.6) return 12;
  if (rating >= 4.3) return 9;
  if (rating >= 4.0) return 6;
  return 3;
}

// 数据可信度 (max 10): more snapshots + real review data = the other numbers
// mean more.
function confidenceScore(snaps: number, latest: SnapLike): number {
  return clamp(2 + 2 * Math.min(snaps, 3) + ((latest.reviews || 0) > 0 ? 2 : 0), 0, 10);
}

export function computeOpportunityScore(first: SnapLike, latest: SnapLike, snaps: number): OpportunityScore {
  const single = snaps < 2;
  const parts: ScorePart[] = [
    { key: "demand", score: demandScore(latest.reviews || 0), max: 30 },
    { key: "momentum", score: momentumScore(first, latest, single), max: 30 },
    { key: "price", score: priceScore(first, latest, single), max: 15 },
    { key: "rating", score: ratingScore(latest.rating || 0), max: 15 },
    { key: "confidence", score: confidenceScore(snaps, latest), max: 10 },
  ];
  const total = parts.reduce((s, p) => s + p.score, 0);
  const grade = total >= 72 ? "A" : total >= 58 ? "B" : total >= 44 ? "C" : "D";
  return { total, grade, parts, singleSnapshot: single };
}

export const GRADE_STYLES: Record<OpportunityScore["grade"], string> = {
  A: "bg-green-100 text-green-700 border-green-200",
  B: "bg-blue-100 text-blue-700 border-blue-200",
  C: "bg-amber-100 text-amber-700 border-amber-200",
  D: "bg-slate-100 text-slate-500 border-slate-200",
};
