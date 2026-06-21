import { clsx } from "clsx";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { AuthenticityLevel } from "@/lib/mock-data";

interface AuthenticityBadgeProps {
  score: number;
  level: AuthenticityLevel;
  size?: "sm" | "md";
}

const CONFIG = {
  high: {
    label: "可信度高",
    icon: ShieldCheck,
    containerClass: "bg-green-50 text-green-700 border-green-200",
    dotClass: "bg-green-500",
  },
  medium: {
    label: "需要留意",
    icon: ShieldAlert,
    containerClass: "bg-yellow-50 text-yellow-700 border-yellow-200",
    dotClass: "bg-yellow-500",
  },
  low: {
    label: "疑似造假",
    icon: ShieldX,
    containerClass: "bg-red-50 text-red-700 border-red-200",
    dotClass: "bg-red-500",
  },
};

export function AuthenticityBadge({ score, level, size = "md" }: AuthenticityBadgeProps) {
  const config = CONFIG[level];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        "flex items-center gap-1.5 border rounded-full font-medium",
        config.containerClass,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      <span>{score}分</span>
      <span className="hidden sm:inline">·</span>
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}
