"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Eye, EyeOff, Loader2, Languages } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, toggle } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError(lang === "zh" ? "请填写电邮和密码" : "Please enter email and password");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError(lang === "zh" ? "电邮或密码不正确，请重试" : "Incorrect email or password, please try again");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      {/* Language toggle */}
      <div className="absolute top-4 right-4">
        <button onClick={toggle}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
          <Languages className="w-3.5 h-3.5" />
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <BarChart3 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{t("nav_tool_name")}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {lang === "zh" ? "快速比较电商平台价格与销量" : "Compare prices across e-commerce platforms"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-6">{t("login_title")}</h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">{t("login_email")}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@aao.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">{t("login_password")}</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={lang === "zh" ? "输入密码" : "Enter password"}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-base">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />{t("login_signing_in")}</> : t("login_btn")}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          {t("login_no_account")}{" "}
          <a href="/signup" className="text-blue-600 hover:underline font-medium">{t("login_signup_link")}</a>
        </p>
        <p className="text-center text-xs text-slate-400 mt-3">© {new Date().getFullYear()} AAO</p>
      </div>
    </div>
  );
}
