"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, BarChart3, Languages, Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

export function Navbar() {
  const router = useRouter();
  const { t, lang, toggle } = useLanguage();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const name =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split("@")[0] ||
          "员工";
        setUserName(name);
      }
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-slate-800 text-sm">AAO</span>
              <span className="text-xs text-slate-500">{t("nav_tool_name")}</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {/* Watchlist */}
            <Link
              href="/watchlist"
              title={lang === "zh" ? "选品清单" : "Watchlist"}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-600 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === "zh" ? "选品清单" : "Watchlist"}</span>
            </Link>

            {/* Language toggle */}
            <button
              onClick={toggle}
              title={lang === "zh" ? "Switch to English" : "切换为中文"}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Languages className="w-3.5 h-3.5" />
              {lang === "zh" ? "EN" : "中文"}
            </button>

            {userName && (
              <span className="text-sm text-slate-600 hidden sm:inline">
                {t("nav_greeting")}，<span className="font-medium text-slate-800">{userName}</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t("nav_logout")}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
