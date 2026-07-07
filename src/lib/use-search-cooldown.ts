"use client";

import { useState, useEffect, useCallback } from "react";

// Persisted so the countdown survives navigation (dashboard → results → back).
const LS_KEY = "aao_last_search_ts";

/**
 * Search cooldown to avoid hammering platforms (esp. Taobao/1688/PDD) and
 * getting the user flagged as a bot. `startCooldown()` stamps "now"; `remaining`
 * ticks down to 0 once per second. Cooldown is measured from when a search is
 * fired, so a slow multi-platform search usually eats most of it already.
 */
export function useSearchCooldown(cooldownSec: number) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const last = Number(localStorage.getItem(LS_KEY) || 0);
      const elapsed = (Date.now() - last) / 1000;
      setRemaining(Math.max(0, Math.ceil(cooldownSec - elapsed)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownSec]);

  const startCooldown = useCallback(() => {
    localStorage.setItem(LS_KEY, String(Date.now()));
    setRemaining(cooldownSec);
  }, [cooldownSec]);

  return { remaining, startCooldown };
}
