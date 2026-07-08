"use client";

import { X, ExternalLink, CheckCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

// Shown once per browser session before the first search that includes China
// platforms. Being logged in to 淘宝/拼多多/1688 is the #1 factor in whether
// those platforms return results (and avoids anti-bot walls), so we remind the
// user to log in FIRST — the user does the logging in themselves, in their own
// tabs. We never touch credentials.
const CN_SITES = [
  { name: "淘宝",   nameEn: "Taobao",    url: "https://www.taobao.com",           color: "bg-red-50 text-red-700 border-red-200" },
  { name: "拼多多", nameEn: "Pinduoduo", url: "https://mobile.yangkeduo.com",     color: "bg-green-50 text-green-700 border-green-200" },
  { name: "1688",  nameEn: "1688",      url: "https://www.1688.com",             color: "bg-amber-50 text-amber-700 border-amber-200" },
];

interface CnLoginReminderModalProps {
  onConfirm: () => void; // user says "I'm logged in, search now"
  onClose: () => void;   // cancel — no search
}

export function CnLoginReminderModal({ onConfirm, onClose }: CnLoginReminderModalProps) {
  const { lang } = useLanguage();
  const zh = lang === "zh";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">

        <div className="relative px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-base">
            🔑 {zh ? "先登录中国平台账号" : "Log in to China platforms first"}
          </h2>
          <button onClick={onClose} className="absolute top-3.5 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {zh
              ? "搜索淘宝、拼多多、1688 前，请确保浏览器已登录这三个平台的账号 —— 已登录时搜索结果最全，也最不容易被平台拦截。"
              : "Before searching Taobao, Pinduoduo or 1688, make sure this browser is logged in to those accounts — logged-in searches return the most results and are least likely to be blocked."}
          </p>

          <div className="space-y-2">
            {CN_SITES.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-transform hover:scale-[1.01] ${s.color}`}>
                <span>{zh ? s.name : s.nameEn}</span>
                <span className="flex items-center gap-1 text-xs font-medium opacity-80">
                  {zh ? "打开网站登录" : "Open & log in"} <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </a>
            ))}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {zh
              ? "登录是你自己在平台官网完成的，本系统不会接触你的账号密码。本提醒每次打开浏览器只出现一次。"
              : "You log in on the platforms' own sites — this tool never touches your credentials. This reminder shows once per browser session."}
          </p>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            {zh ? "取消" : "Cancel"}
          </button>
          <button onClick={onConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {zh ? "都登录好了，开始搜索" : "All logged in — search"}
          </button>
        </div>
      </div>
    </div>
  );
}
