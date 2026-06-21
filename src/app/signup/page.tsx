"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) { setError("请填写所有字段"); return; }
    if (password.length < 6) { setError("密码至少 6 位"); return; }
    if (password !== confirm) { setError("两次密码不一致"); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    setLoading(false);

    if (authError) {
      setError(authError.message === "User already registered"
        ? "该邮箱已注册，请直接登录"
        : "注册失败，请重试");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg mb-4 mx-auto">
            <BarChart3 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">注册成功！</h1>
          <p className="text-slate-500 text-sm mb-6">
            请检查邮箱并点击验证链接，完成后即可登录。
          </p>
          <Link href="/login" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors">
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <BarChart3 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">AAO 竞品分析工具</h1>
          <p className="text-slate-500 text-sm mt-1">员工账号注册</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-6">新员工注册</h2>
          <form onSubmit={handleSignup} className="flex flex-col gap-5">

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">姓名</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="你的名字"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">电子邮件</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@example.com"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">密码</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-600">确认密码</label>
              <input type={showPassword ? "text" : "password"} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} placeholder="再输入一次"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-base">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />注册中…</> : "注册"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          已有账号？{" "}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">返回登录</Link>
        </p>
        <p className="text-center text-xs text-slate-400 mt-3">© 2025 AAO · 仅供内部员工使用</p>
      </div>
    </div>
  );
}
