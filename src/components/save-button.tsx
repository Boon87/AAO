"use client";

import { useState } from "react";
import { Bookmark, Check, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { Product } from "@/lib/mock-data";
import { saveSnapshot, removeProduct, productKey } from "@/lib/watchlist";
import { useLanguage } from "@/lib/i18n";

// Bookmark toggle for the results cards → adds a snapshot to the watchlist.
export function SaveButton({ product, query, initialSaved }: { product: Product; query: string; initialSaved?: boolean }) {
  const { lang } = useLanguage();
  const [saved, setSaved] = useState(!!initialSaved);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (saved) { await removeProduct(productKey(product)); setSaved(false); }
      else { await saveSnapshot(product, query); setSaved(true); }
    } catch {
      /* not logged in / network — silently no-op */
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      title={saved ? (lang === "zh" ? "已在选品清单，点击移除" : "In watchlist — click to remove") : (lang === "zh" ? "加入选品清单" : "Add to watchlist")}
      className={clsx("w-7 h-7 flex items-center justify-center rounded-lg border shadow-sm transition-colors",
        saved ? "bg-amber-500 border-amber-500 text-white" : "bg-white/90 border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300")}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
    </button>
  );
}
