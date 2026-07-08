"use client";

import { useState, useEffect, useCallback } from "react";

// Daily budget for China-platform (淘宝/拼多多/1688) searches. Those platforms
// have the harshest anti-bot, so a hard daily ceiling is the single most
// effective guard against a ban for a heavy user — it stops the "search dozens
// of products back-to-back" pattern that trips detection. Adjust freely.
export const CN_DAILY_LIMIT = 50; // hard stop for the day
export const CN_DAILY_WARN = 35;  // start warning from here

const LS_KEY = "aao_cn_search_day"; // { date: "YYYY-MM-DD", count: N }

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function readCount(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    if (raw.date === todayStr()) return raw.count || 0;
  } catch {
    /* ignore */
  }
  return 0; // new day (or nothing stored) → 0
}

export function useCnSearchBudget() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(readCount());
    // Re-read on focus: the day may have rolled over, or another tab searched.
    const onFocus = () => setCount(readCount());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const bump = useCallback(() => {
    const n = readCount() + 1;
    localStorage.setItem(LS_KEY, JSON.stringify({ date: todayStr(), count: n }));
    setCount(n);
  }, []);

  return {
    count,
    bump,
    atLimit: count >= CN_DAILY_LIMIT,
    warn: count >= CN_DAILY_WARN,
  };
}
