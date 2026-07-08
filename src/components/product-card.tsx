"use client";

import { Star, ShoppingBag, MessageSquare, CheckSquare, Square } from "lucide-react";
import { clsx } from "clsx";
import { AuthenticityBadge } from "./authenticity-badge";
import { PLATFORM_LABELS, PLATFORM_COLORS, type Product } from "@/lib/mock-data";
import { useLanguage } from "@/lib/i18n";

interface ProductCardProps {
  product: Product;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectable?: boolean;
}

export function ProductCard({ product, selected, onToggleSelect, selectable }: ProductCardProps) {
  const { t } = useLanguage();
  const hasUrl = product.url && product.url !== "#";
  return (
    <div
      className={clsx(
        "bg-white rounded-xl border-2 transition-all duration-150 overflow-hidden",
        selected
          ? "border-blue-500 shadow-md shadow-blue-100"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
        hasUrl && "cursor-pointer"
      )}
      onClick={() => hasUrl && window.open(product.url, "_blank", "noopener,noreferrer")}
    >
      {/* Image area */}
      <div className="relative">
        <img
          src={product.imageUrl}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="w-full h-40 object-cover"
        />
        {/* Platform badge */}
        <span
          className={clsx(
            "absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold",
            PLATFORM_COLORS[product.platform]
          )}
        >
          {PLATFORM_LABELS[product.platform]}
        </span>
        {/* Select checkbox */}
        {selectable && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(product.id); }}
            className="absolute top-2 right-2 bg-white rounded-md p-0.5 shadow"
          >
            {selected ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5 text-slate-400" />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-2">
        <p className="text-sm text-slate-700 font-medium line-clamp-2 leading-snug">
          {product.name}
        </p>

        {/* Price */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-slate-900">RM {product.price.toFixed(2)}</span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-sm text-slate-400 line-through">
              RM {product.originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {product.sales > 0 ? (
            <span className="flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5" />
              {product.sales.toLocaleString()} {t("card_sales")}
            </span>
          ) : null}
          {product.reviews > 0 ? (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {product.reviews.toLocaleString()} {t("card_reviews")}
            </span>
          ) : null}
          {product.rating > 0 ? (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {product.rating.toFixed(1)}
            </span>
          ) : null}
          {product.sales === 0 && product.reviews === 0 && product.rating === 0 && (
            <span className="text-slate-400 italic">{t("card_no_sales")}</span>
          )}
        </div>

        {/* Shop name */}
        <p className="text-xs text-slate-400 truncate">{t("cmp_attr_shop")}：{product.shopName}</p>

        {/* Authenticity — no sales/reviews/rating means nothing to verify, so
            don't show a misleading "100 分" green badge */}
        <div className="pt-1 border-t border-slate-100">
          {product.sales === 0 && product.reviews === 0 && product.rating === 0 ? (
            <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              {t("card_no_score")}
            </span>
          ) : (
            <AuthenticityBadge score={product.authenticityScore} level={product.authenticityLevel} size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}
