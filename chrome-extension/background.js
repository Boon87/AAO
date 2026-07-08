// Pending search requests, keyed by tab ID
const pendingSearches = new Map();

// Pending PDD searches, keyed by tab ID
const pendingPDD = new Map();

// Pending 1688 searches, keyed by tab ID
const pending1688 = new Map();

// Short-lived result cache to avoid re-hitting sites (cuts anti-bot triggers).
// Keyed by "platform:keyword". TTL 8 min. Anti-bot results are NOT cached.
const resultCache = new Map();
const CACHE_TTL_MS = 8 * 60 * 1000;
function getCached(platform, keyword) {
  const hit = resultCache.get(platform + ":" + keyword);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    console.log("[AAO] cache hit:", platform, keyword, "(", hit.data?.items?.length || 0, "items)");
    return hit.data;
  }
  return null;
}
function setCached(platform, keyword, data) {
  // Only cache real successful results — never cache empty/anti-bot/null
  if (data && data.items && data.items.length > 0 && !data.antiBot) {
    resultCache.set(platform + ":" + keyword, { ts: Date.now(), data });
  }
}

// Keep service worker alive via chrome.alarms (fires every 25s, under Chrome's 30s kill threshold)
chrome.alarms.create("sw-keepalive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => { /* heartbeat — keeps SW from being killed */ });

// Also keep alive via content script port
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "keepalive") {
    port.onDisconnect.addListener(() => {});
  }
});

// Recursively search an object tree for a node containing listItems array
function findListItems(obj, depth) {
  if (!obj || typeof obj !== "object" || depth > 8) return null;
  if (Array.isArray(obj)) return null;
  if (Array.isArray(obj.listItems) && obj.listItems.length > 0) return obj;
  if (obj.mods && Array.isArray(obj.mods.listItems) && obj.mods.listItems.length > 0) return obj.mods;
  for (const v of Object.values(obj)) {
    const found = findListItems(v, depth + 1);
    if (found) return found;
  }
  return null;
}

// Lazada: open tab, wait for load, extract from embedded JSON or DOM
async function searchLazadaViaTab(url, timeoutMs = 20000) {
  const tab = await chrome.tabs.create({ url, active: false });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(async () => {
      chrome.tabs.remove(tab.id).catch(() => {});
      reject(new Error("Lazada 搜索超时"));
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId !== tab.id || info.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(listener);

      // Wait for JS to hydrate (Lazada is Next.js / client-rendered)
      setTimeout(async () => {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: async () => {
              // ── Helper: dig into any object for listItems ──
              function findList(obj, depth) {
                if (!obj || typeof obj !== "object" || depth > 8) return null;
                if (Array.isArray(obj)) return null;
                if (Array.isArray(obj.listItems) && obj.listItems.length > 0) return { listItems: obj.listItems };
                if (obj.mods && Array.isArray(obj.mods.listItems) && obj.mods.listItems.length > 0) return { listItems: obj.mods.listItems };
                for (const v of Object.values(obj)) {
                  const f = findList(v, depth + 1);
                  if (f) return f;
                }
                return null;
              }

              // ── 1) __NEXT_DATA__ (Next.js SSR) ──
              try {
                const nd = document.getElementById("__NEXT_DATA__");
                if (nd?.textContent) {
                  const parsed = JSON.parse(nd.textContent);
                  const found = findList(parsed, 0);
                  if (found) return { source: "nextdata", data: found };
                }
              } catch {}

              // ── 2) Window globals ──
              const win = window;
              for (const key of ["pageData", "__pageData__", "__INITIAL_DATA__", "initialData", "__DATA__", "app"]) {
                try {
                  const g = win[key];
                  if (!g) continue;
                  const found = findList(g, 0);
                  if (found) return { source: "global:" + key, data: found };
                } catch {}
              }

              // ── 3) Script tags containing image URLs and product data ──
              const scripts = document.querySelectorAll("script:not([src])");
              for (const s of scripts) {
                const txt = s.textContent || "";
                if (txt.length < 500) continue;
                if (!txt.includes("listItems") && !txt.includes('"mods"') && !txt.includes("imgUrl") && !txt.includes("img.lazcdn")) continue;
                const match = txt.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                if (!match) continue;
                try {
                  const parsed = JSON.parse(match[0]);
                  const found = findList(typeof parsed === "object" ? parsed : { items: parsed }, 0);
                  if (found) return { source: "script", data: found };
                } catch {}
              }

              // ── 4) DOM extraction (fallback) ──
              // Collect real image URLs from ALL img tags first
              const imgUrlMap = new Map(); // img element → best URL
              document.querySelectorAll("img").forEach(img => {
                // Try all possible lazy-load attributes (collect BEFORE setting src)
                const candidates = [
                  img.getAttribute("data-src"),
                  img.getAttribute("data-lazy-src"),
                  img.getAttribute("data-original"),
                  img.getAttribute("data-origin"),
                  img.getAttribute("lazy-src"),
                  img.getAttribute("data-aload"),
                  img.getAttribute("data-srcset")?.split(",")[0]?.trim()?.split(" ")[0],
                  img.getAttribute("srcset")?.split(",")[0]?.trim()?.split(" ")[0],
                ].filter(u => u && !u.startsWith("data:") && u.includes("http"));

                // Also check current src if already loaded
                if (img.src && !img.src.startsWith("data:") && img.src.includes("http") &&
                    !img.src.includes("placeholder") && !img.src.includes("1x1") && !img.src.includes("blank")) {
                  candidates.push(img.src);
                }

                // Prefer lazcdn or well-known image CDNs
                const best = candidates.find(u => u.includes("lazcdn") || u.includes("slatic")) ||
                             candidates.find(u => u.includes("img.")) ||
                             candidates[0];

                if (best) {
                  imgUrlMap.set(img, best);
                  img.src = best; // force load
                }

                // Also handle <picture><source>
                img.closest("picture")?.querySelectorAll("source").forEach(src => {
                  const ss = src.getAttribute("data-srcset") || src.getAttribute("data-src");
                  if (ss) src.srcset = ss;
                });
              });

              // Scroll to trigger IntersectionObserver-based lazy loaders
              window.scrollTo(0, document.body.scrollHeight);
              await new Promise(r => setTimeout(r, 500));
              window.scrollTo(0, document.body.scrollHeight / 2);
              await new Promise(r => setTimeout(r, 500));
              window.scrollTo(0, 0);
              if (window.lazySizes) { try { window.lazySizes.loadAll(); } catch {} }

              // Wait 2s for images to actually load after src is set
              await new Promise(r => setTimeout(r, 2000));

              const cards = Array.from(document.querySelectorAll("[data-qa-locator='product-item']"));
              if (!cards.length) {
                return { source: "debug", title: document.title, url: location.href, bodySnippet: document.body?.innerHTML?.slice(0, 2000) };
              }

              // Helper: only accept real http image URLs, reject data URIs
              const realUrl = (u) => u && typeof u === "string" && u.startsWith("http") ? u : "";

              // Helper: extract real image URL from React fiber props
              const getFiberImg = (el) => {
                try {
                  const key = Object.keys(el).find(k =>
                    k.startsWith("__reactFiber") || k.startsWith("__reactProps") || k.startsWith("__reactInternalInstance")
                  );
                  if (!key) return "";
                  let node = el[key];
                  for (let i = 0; i < 12 && node; i++) {
                    const props = node.memoizedProps || node.pendingProps;
                    if (props) {
                      if (realUrl(props.src)) return props.src;
                      if (realUrl(props["data-src"])) return props["data-src"];
                      if (realUrl(props.imgSrc)) return props.imgSrc;
                      if (realUrl(props.image)) return props.image;
                    }
                    node = node.return;
                  }
                } catch {}
                return "";
              };

              const items = cards.slice(0, 20).map((card) => {
                const anchor = card.querySelector("a") || (card.tagName === "A" ? card : null);
                const img = card.querySelector("img");

                const texts = [];
                const walk = (node) => {
                  if (node.nodeType === 3) { const t = node.textContent.trim(); if (t) texts.push(t); }
                  else node.childNodes.forEach(walk);
                };
                walk(card);

                const priceStr = texts.find(t => /RM\s*[\d,]+/.test(t)) || "";
                const price = priceStr.replace(/[^0-9.]/g, "") || "0";
                const titleCandidates = texts.filter(t => t.length > 5 && !t.includes("RM") && !/^\d+$/.test(t));
                const name = titleCandidates.sort((a, b) => b.length - a.length)[0] || anchor?.title || "";
                const ratingStr = texts.find(t => /^[1-5]\.\d$/.test(t)) || "";
                const reviewStr = texts.find(t => /^\d[\d,]*[kK]?$/.test(t) && t !== price) || "0";

                // Best image: map → React fiber → currentSrc → src attrs (all must be http, no data URIs)
                const image = (img ? realUrl(imgUrlMap.get(img)) : "") ||
                  (img ? getFiberImg(img) : "") ||
                  realUrl(img?.currentSrc) ||
                  realUrl(img?.getAttribute("data-src")) ||
                  realUrl(img?.getAttribute("data-lazy-src")) ||
                  realUrl(img?.getAttribute("data-original")) ||
                  realUrl(img?.getAttribute("data-origin")) ||
                  realUrl(img?.src) ||
                  // Also check all imgs in card (not just first)
                  (() => {
                    for (const i of card.querySelectorAll("img")) {
                      const u = realUrl(i.currentSrc) || realUrl(i.src);
                      if (u) return u;
                    }
                    return "";
                  })();

                return {
                  name,
                  price,
                  image,
                  itemUrl: anchor?.getAttribute("href") || "",
                  ratingScore: ratingStr,
                  review: reviewStr.replace(/[^0-9]/g, "") || "0",
                };
              }).filter(i => i.name);

              if (!items.length) return null;
              return { source: "dom", items };
            },
          });

          clearTimeout(timeout);
          chrome.tabs.remove(tab.id).catch(() => {});
          const result = results[0]?.result;
          console.log("[AAO] Lazada extract source:", result?.source, "items:", result?.items?.length ?? result?.data?.listItems?.length ?? "?");
          console.log("[AAO] Lazada first image:", result?.items?.[0]?.image || result?.data?.listItems?.[0]?.image || "EMPTY");
          resolve({ data: result });
        } catch (e) {
          clearTimeout(timeout);
          chrome.tabs.remove(tab.id).catch(() => {});
          reject(e);
        }
      }, 6000); // wait 6s for hydration
    });
  });
}

// Open a platform search tab and wait for intercepted API data
function searchViaTab(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active: false }).then((tab) => {
      const timeout = setTimeout(() => {
        pendingSearches.delete(tab.id);
        chrome.tabs.remove(tab.id).catch(() => {});
        reject(new Error("搜索超时，请确认已登录对应平台"));
      }, timeoutMs);

      pendingSearches.set(tab.id, { resolve, timeout });
    });
  });
}

// Generic popup scraper — unfocused popup, waits, scrolls, extracts (user stays on AAO)
async function scrapeWithPopup(url, extractFn, waitMs = 5000) {
  const win = await chrome.windows.create({ url, type: "popup", width: 900, height: 700, focused: false });
  const tabId = win.tabs[0].id;
  const cleanup = () => chrome.windows.remove(win.id).catch(() => {});

  await new Promise((resolve) => {
    let done = false;
    const fallback = setTimeout(() => { if (!done) { done = true; resolve(); } }, 15000);
    chrome.tabs.onUpdated.addListener(function listener(tid, info) {
      if (tid !== tabId || info.status !== "complete") return;
      if (!done) { done = true; chrome.tabs.onUpdated.removeListener(listener); clearTimeout(fallback); resolve(); }
    });
  });

  await new Promise(r => setTimeout(r, waitMs));

  for (const pos of [1500, 4000, 7000]) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId }, world: "MAIN",
        func: (y) => window.scrollTo({ top: y, behavior: "smooth" }),
        args: [pos],
      });
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }

  try {
    const results = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: extractFn });
    cleanup();
    const result = results[0]?.result ?? null;
    console.log("[AAO] popup extract:", result?.source, "items:", result?.items?.length);
    return { data: result };
  } catch (e) {
    cleanup();
    return { data: null };
  }
}

// Taobao scraper — popup window (visible for JS rendering, unfocused so user stays on AAO)
// Human-like jittered delay: base ms ± up to `jitter` ms
const humanDelay = (base, jitter = 0) =>
  new Promise(r => setTimeout(r, base + Math.floor(Math.random() * (jitter + 1))));

// Random integer in [min, max]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Human-like scroll pattern — DIFFERENT every run so the access pattern isn't a
// fixed robot fingerprint. Descends the page in random-sized steps, occasionally
// bounces back UP a little (like a person re-reading), with random pauses and a
// random number of steps. Still nets downward far enough to trigger lazy-load.
// Pass world="MAIN" for Taobao (needs main-world), omit for 1688 (isolated is fine).
async function humanScroll(tabId, world) {
  const runScroll = async (top) => {
    const opts = world
      ? { target: { tabId }, world, func: (y) => window.scrollTo({ top: y, behavior: "smooth" }), args: [top] }
      : { target: { tabId }, func: (y) => window.scrollTo({ top: y, behavior: "smooth" }), args: [top] };
    try { await chrome.scripting.executeScript(opts); } catch {}
  };

  const steps = randInt(3, 6);           // vary count each run; fewer = fewer requests = safer
  let y = randInt(250, 950);             // random opening nudge
  for (let i = 0; i < steps; i++) {
    // ~1 in 4 steps (after the first couple) drift back up a bit, like a human
    if (i > 1 && Math.random() < 0.28) {
      y = Math.max(0, y - randInt(350, 1200));
    } else {
      y += randInt(1100, 3300);          // random downward jump, not a fixed grid
    }
    await runScroll(y);
    await new Promise((r) => setTimeout(r, randInt(850, 2700))); // random pause
  }
  // settle: sometimes to the top, sometimes partway up — also randomized
  await runScroll(Math.random() < 0.5 ? 0 : randInt(150, 900));
  await new Promise((r) => setTimeout(r, randInt(500, 1100)));
}

// 1688 is a WHOLESALE search engine tuned for short supplier keywords, not
// Taobao-style marketing titles. TWO problems with a title like "史努比纯棉四件套
// 可爱卡通漫画学生宿舍被套":
//   1. Licensed brand/character names (史努比/迪士尼/Hello Kitty…): 1688 suppliers
//      avoid the trademark in their titles, so a brand query just returns the
//      nearest generic category anyway. We STRIP the brand and search the CATEGORY
//      — exactly what a merchant sourcing for private-label wants. (Taobao/PDD keep
//      the brand; distillCnKeyword only runs for 1688.)
//   2. Long marketing filler makes 1688's segmenter latch onto junk words. We strip
//      it too — but KEEP 卡通, which becomes the useful generic once a brand is gone.
// e.g. 史努比纯棉四件套可爱卡通漫画学生宿舍被套 → 纯棉四件套卡通被套
const CN_BRAND = /史努比|snoopy|哆啦a?梦|叮当猫|小熊维尼|维尼熊?|winnie\s?the\s?pooh|winnie|pooh|迪士尼|disney|米奇|米老鼠|mickey|米妮|minnie|唐老鸭|hello\s?kitty|凯蒂猫|kitty|三丽鸥|sanrio|玉桂狗|大耳狗|库洛米|kuromi|美乐蒂|melody|皮卡丘|pikachu|宝可梦|pokemon|龙猫|totoro|海绵宝宝|spongebob|蜡笔小新|奥特曼|ultraman|迪迦|变形金刚|transformers|漫威|marvel|蜘蛛侠|spider-?man|冰雪奇缘|艾莎|elsa|frozen|小猪佩奇|佩奇|peppa|汪汪队|paw\s?patrol|芭比|barbie|布朗熊|可妮兔|line\s?friends|loopy|露比|卡皮巴拉|水豚|capybara|玲娜贝儿|星黛露|linabell|草莓熊|lotso|加菲猫|garfield|猫和老鼠|tom\s?and\s?jerry|忍者神龟|愤怒的?小鸟|angry\s?birds|超级马里奥|马里奥|super\s?mario/gi;
const CN_FILLER = /可爱|漫画|新款|爆款|网红|ins风?|时尚|简约|创意|高档|高级|韩式|日式|北欧|多功能|家用|学生|宿舍|礼品|批发|厂家|直销|定制|包邮|特价|促销|清仓|正品|官方|旗舰店?|神器|202\d年?|四季|春夏|秋冬|加厚/g;
function distillCnKeyword(kw) {
  const raw = (kw || "").trim();
  // Always strip licensed brand/character names (wholesale rarely carries them by name).
  let k = raw.replace(CN_BRAND, "").replace(/\s+/g, " ").trim();
  // Long titles: also strip pure-marketing filler (keeps 卡通 — see note above).
  if (k.length > 10) k = k.replace(CN_FILLER, "").replace(/\s+/g, " ").trim();
  if (k.length < 3) k = raw;                      // stripped too much — keep original
  if (k.length > 14) k = k.slice(0, 14);          // wholesale search likes it short
  return k;
}

// Space out the START of Alibaba-family scrapes. Taobao and 1688 are both Alibaba
// and share anti-bot/IP reputation, so hitting them at the same instant is the
// riskiest thing we can do. Each scrape waits for its "slot", then books the next
// one a random 3–7s later — so they take turns instead of firing together. Also
// naturally throttles rapid repeat searches.
let alibabaNextSlot = 0;
async function alibabaGate() {
  const now = Date.now();
  const wait = Math.max(0, alibabaNextSlot - now);
  alibabaNextSlot = Math.max(now, alibabaNextSlot) + randInt(3000, 7000);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

// A platform showed a human-verification wall (滑块/captcha/异常流量). We NEVER solve
// it ourselves — we bring the popup to the FRONT (focused, enlarged, flashing) so the
// USER can pass it, then wait for the wall to clear and resume scraping. Returns true
// if the user passed it in time, false on timeout. `onStart` (optional) fires once the
// wall is surfaced — used to cancel the caller's own timeout while the user verifies.
async function promptUserVerification(winId, tabId, world, onStart) {
  console.log("[AAO] Verification wall — surfacing popup to user");
  try {
    await chrome.windows.update(winId, { focused: true, drawAttention: true, state: "normal", width: 1120, height: 880 });
  } catch {}
  if (typeof onStart === "function") { try { onStart(); } catch {} }
  const checkOpts = world
    ? { target: { tabId }, world, func: detectAntiBot }
    : { target: { tabId }, func: detectAntiBot };
  const deadline = Date.now() + 85000; // give the user up to ~85s to complete it
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    let walled = true;
    try {
      const [{ result }] = await chrome.scripting.executeScript(checkOpts);
      walled = !!result?.antiBot;
    } catch { walled = true; }
    if (!walled) {
      console.log("[AAO] Verification passed by user — resuming scrape");
      try { await chrome.windows.update(winId, { focused: false }); } catch {}
      await humanDelay(1200, 800); // let the real results page render after passing
      return true;
    }
  }
  console.log("[AAO] Verification not completed in time — giving up");
  return false;
}

// Detect Taobao/1688 "unusual traffic" / slider-verification anti-bot wall.
function detectAntiBot() {
  const t = (document.body?.innerText || "");
  const lower = t.toLowerCase();
  // Only treat as anti-bot when the page is essentially JUST the wall (short body),
  // so a stray keyword in a normal results page doesn't false-positive.
  const isShort = t.replace(/\s/g, "").length < 600;
  const wallText = /unusual traffic|异常流量|访问异常|存在异常|滑动验证|拖动滑块|拖动下方滑块|向右滑动|完成验证|安全验证|请输入验证码|verification code|please try again later/i.test(t);
  const wallUrl = /login\.taobao\.com|login\.1688\.com|punish|_____tmd_____|nocaptcha|captcha|\/sec\//i.test(location.href);
  return { antiBot: wallUrl || (wallText && isShort) };
}

async function scrapeTaobaoWithScroll(url) {
  // Randomize the viewport size a little each run so it's not a fixed fingerprint
  const win = await chrome.windows.create({ url, type: "popup", width: randInt(860, 1120), height: randInt(680, 860), focused: false });
  const tabId = win.tabs[0].id;
  const cleanup = () => chrome.windows.remove(win.id).catch(() => {});

  // Wait for page to complete
  await new Promise((resolve) => {
    let done = false;
    const fallback = setTimeout(() => { if (!done) { done = true; resolve(); } }, 15000);
    chrome.tabs.onUpdated.addListener(function listener(tid, info) {
      if (tid !== tabId || info.status !== "complete") return;
      if (!done) { done = true; chrome.tabs.onUpdated.removeListener(listener); clearTimeout(fallback); resolve(); }
    });
  });

  // Settle after load — randomized so the access pattern isn't a fixed fingerprint
  await humanDelay(4500, 2500); // 4.5–7.0s

  // Early anti-bot check: bail out cleanly with a clear signal instead of scraping junk
  try {
    const [{ result: pre }] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: detectAntiBot });
    if (pre?.antiBot) {
      // Surface the captcha to the user instead of silently failing
      const passed = await promptUserVerification(win.id, tabId, "MAIN");
      if (!passed) {
        cleanup();
        console.log("[AAO] Taobao verification not done — skipping scrape");
        return { data: { source: "anti_bot", antiBot: true, items: [] } };
      }
      // user passed → continue to scroll + extract below
    }
  } catch {}

  // Human-like scroll — randomized (up/down, step count, pauses) every run so
  // Taobao can't fingerprint a fixed robot pattern. Triggers lazy loading.
  await humanScroll(tabId, "MAIN");

  try {
    // Re-check for anti-bot wall that may appear after scrolling
    const [{ result: post }] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: detectAntiBot });
    if (post?.antiBot) {
      const passed = await promptUserVerification(win.id, tabId, "MAIN");
      if (!passed) {
        cleanup();
        console.log("[AAO] Taobao verification not done (post-scroll) — skipping");
        return { data: { source: "anti_bot", antiBot: true, items: [] } };
      }
      await humanScroll(tabId, "MAIN"); // reload products after passing
    }
    const results = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: extractTaobao });
    cleanup();
    const result = results[0]?.result ?? null;
    console.log("[AAO] Taobao scroll extract:", result?.source, "items:", result?.items?.length);
    return { data: result };
  } catch (e) {
    cleanup();
    return { data: null };
  }
}

// Generic DOM scraper — runs executeScript on an already-loaded tab
async function scrapeViaExecuteScript(url, extractFn, waitMs = 5000, active = false) {
  const tab = await chrome.tabs.create({ url, active });
  console.log("[AAO] Tab created id:", tab.id, url);

  // Wait for "complete" or at most 15s — whichever comes first
  await new Promise((resolve) => {
    let done = false;
    const fallback = setTimeout(() => {
      if (!done) { done = true; console.log("[AAO] Tab load timed out, trying anyway"); resolve(); }
    }, 15000);
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId !== tab.id) return;
      if (info.status === "complete" && !done) {
        done = true;
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(fallback);
        console.log("[AAO] Tab complete");
        resolve();
      }
    });
  });

  // Extra wait for JS hydration
  await new Promise(r => setTimeout(r, waitMs));

  try {
    console.log("[AAO] Running executeScript");
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: extractFn,
    });
    chrome.tabs.remove(tab.id).catch(() => {});
    const result = results[0]?.result ?? null;
    console.log("[AAO] result source:", result?.source);
    console.log("[AAO] result items:", result?.items?.length ?? result?.error);
    console.log("[AAO] result url:", result?.url);
    console.log("[AAO] result title:", result?.title);
    if (result?.classes) console.log("[AAO] result classes:", result.classes);
    if (result?.bodyText) console.log("[AAO] result bodyText:", result.bodyText);
    if (result?.debug) console.log("[AAO] result debug:", result.debug);
    return { data: result };
  } catch (e) {
    console.log("[AAO] executeScript failed:", e.message);
    chrome.tabs.remove(tab.id).catch(() => {});
    return { data: null };
  }
}

// PDD: popup window (focused:false to not steal focus), dual strategy API + DOM
async function searchPDDViaTab(url) {
  const win = await chrome.windows.create({ url, type: "popup", width: 390, height: 844, focused: false });
  const tabId = win.tabs[0].id;
  console.log("[AAO] PDD popup created:", tabId);

  return new Promise((resolve) => {
    let resolved = false;
    let pddLoginPrompted = false;
    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      pendingPDD.delete(tabId);
      chrome.windows.remove(win.id).catch(() => {});
      resolve({ data: result });
    };

    const timeout = setTimeout(() => {
      const pending = pendingPDD.get(tabId);
      const accumulated = pending?.items || [];
      finish(accumulated.length > 0 ? { source: "api_accumulated", items: accumulated } : null);
    }, 22000);
    pendingPDD.set(tabId, { resolve: (r) => { clearTimeout(timeout); finish(r.data); }, timeout, items: [] });

    chrome.tabs.onUpdated.addListener(async function listener(tid, info) {
      if (tid !== tabId || info.status !== "complete") return;
      const tabInfo = await chrome.tabs.get(tabId).catch(() => null);
      const curUrl = tabInfo?.url || "";

      // PDD now gates search behind login → bring the popup to the FRONT so the USER
      // can sign in (phone + SMS). After they log in PDD redirects back to search_result
      // and we continue. We never enter their credentials — only surface the login page.
      if (/login\.html/i.test(curUrl)) {
        if (!pddLoginPrompted) {
          pddLoginPrompted = true;
          console.log("[AAO] PDD requires login — surfacing popup to user");
          try { await chrome.windows.update(win.id, { focused: true, drawAttention: true, width: 480, height: 860 }); } catch {}
          const pending = pendingPDD.get(tabId);
          if (pending?.timeout) clearTimeout(pending.timeout);
          const t2 = setTimeout(() => {
            const p = pendingPDD.get(tabId);
            const acc = p?.items || [];
            finish(acc.length > 0 ? { source: "api_accumulated", items: acc } : { source: "login_required", needsLogin: true, items: [] });
          }, 90000); // give the user up to 90s to sign in
          if (pending) pending.timeout = t2;
        }
        return; // wait for the user to log in; PDD will navigate back to search_result
      }

      // Ignore any other intermediate pages; only act on the real search results page
      if (!/search_result/i.test(curUrl)) return;
      chrome.tabs.onUpdated.removeListener(listener);
      if (pddLoginPrompted) { try { await chrome.windows.update(win.id, { focused: false }); } catch {} }

      // At 3s: directly call PDD search API from within the page context (uses page cookies)
      setTimeout(async () => {
        if (resolved) return;
        try {
          const keyword = decodeURIComponent(url.split("search_key=")[1] || "");
          const res = await chrome.scripting.executeScript({
            target: { tabId }, world: "MAIN",
            func: async (kw) => {
              // Try multiple PDD search API endpoints
              const endpoints = [
                `/proxy/api?pdduid=0&type=api&url=/api/h5/search&request=${encodeURIComponent(JSON.stringify({ search_key: kw, page: 1, page_size: 20, sort_type: 0 }))}`,
                `/proxy/api?pdduid=0&type=v3&request=${encodeURIComponent(JSON.stringify({ keyword: kw, page: 1, page_size: 20, sort_type: 0, list_id: "", search_id: "" }))}`,
                `/api/pegasus/search?keyword=${encodeURIComponent(kw)}&page=1&page_size=20`,
              ];
              for (const ep of endpoints) {
                try {
                  const r = await fetch(ep, { credentials: "include" });
                  const text = await r.text();
                  if (text.includes("goods_id") || text.includes("goods_name")) return text;
                } catch {}
              }
              return null;
            },
            args: [keyword],
          });
          const text = res?.[0]?.result;
          if (text) {
            // Parse and extract items same as pdd-main.js logic
            try {
              const data = JSON.parse(text);
              function findList(obj, d) {
                if (!obj || typeof obj !== "object" || d > 8) return null;
                if (Array.isArray(obj)) {
                  if (obj.length > 0 && (obj[0]?.goods_id || obj[0]?.goods_name)) return obj;
                  return null;
                }
                for (const v of Object.values(obj)) { const f = findList(v, d + 1); if (f) return f; }
                return null;
              }
              const list = findList(data, 0);
              if (list?.length) {
                const items = list.slice(0, 20).map(i => ({
                  name: i.goods_name || i.name || "",
                  price: String((i.min_group_price || i.min_normal_price || i.price || 0) / 100),
                  image: i.goods_img || i.goods_img_url || i.goods_thumbnail_url || "",
                  itemUrl: `https://mobile.yangkeduo.com/goods.html?goods_id=${i.goods_id || ""}`,
                  sales: String(i.sales_tip || i.sold_quantity || 0),
                  shop: i.mall_name || "拼多多商家",
                })).filter(i => i.name && parseFloat(i.price) > 0);
                if (items.length > 0) {
                  console.log("[AAO] PDD direct API:", items.length, "items");
                  finish({ source: "direct_api", items });
                  return;
                }
              }
            } catch {}
          }
        } catch (e) { console.log("[AAO] PDD direct API failed:", e.message); }
      }, 3000);

      // Scroll to trigger lazy loading / pagination (more steps → more products)
      for (const [delay, pos] of [[4000, 2000], [6000, 5000], [8000, 9000], [10000, 14000], [12000, 20000]]) {
        setTimeout(async () => {
          if (resolved) return;
          try {
            await chrome.scripting.executeScript({
              target: { tabId }, world: "MAIN",
              func: (y) => window.scrollTo({ top: y, behavior: "smooth" }),
              args: [pos],
            });
          } catch {}
        }, delay);
      }

      // DOM fallback at 12s — runs regardless of whether content script worked
      setTimeout(async () => {
        if (resolved) return;
        try {
          const res = await chrome.scripting.executeScript({
            target: { tabId }, world: "MAIN", func: extractPDD,
          });
          const domResult = res?.[0]?.result;
          console.log("[AAO] PDD DOM fallback:", domResult?.source, "items:", domResult?.items?.length);
          if (domResult?.items?.length > 0) {
            const pending = pendingPDD.get(tabId);
            const apiItems = pending?.items || [];
            // Merge DOM items with any API-intercepted items
            const seen = new Set(apiItems.map(i => i.itemUrl).filter(Boolean));
            const merged = [...apiItems];
            for (const item of domResult.items) {
              if (!seen.has(item.itemUrl)) { seen.add(item.itemUrl); merged.push(item); }
            }
            if (merged.length > 0) {
              if (pending?.timeout) clearTimeout(pending.timeout);
              finish({ source: "merged", items: merged });
            }
          }
        } catch (e) {
          console.log("[AAO] PDD DOM fallback failed:", e.message);
        }
      }, 14500);
    });
  });
}

// PDD-specific scraper: active:true bypasses visibilityState check
async function scrapeViaExecuteScriptPDD(url) {
  const tab = await chrome.tabs.create({ url, active: true });
  console.log("[AAO] PDD Tab created id:", tab.id);

  // Wait for tab "complete" or 15s fallback
  await new Promise((resolve) => {
    let done = false;
    const fallback = setTimeout(() => { if (!done) { done = true; resolve(); } }, 15000);
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId !== tab.id) return;
      if (info.status === "complete" && !done) {
        done = true;
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(fallback);
        console.log("[AAO] PDD Tab complete");
        resolve();
      }
    });
  });

  // Single 10s wait for React + API + rendering to finish
  await new Promise(r => setTimeout(r, 10000));

  let result = null;
  try {
    console.log("[AAO] PDD Running extractScript");
    const res = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: extractPDD,
    });
    result = res[0]?.result ?? null;
  } catch (e) {
    console.log("[AAO] PDD executeScript failed:", e.message);
  }

  chrome.tabs.remove(tab.id).catch(() => {});
  console.log("[AAO] PDD result source:", result?.source, "items:", result?.items?.length ?? result?.error);
  if (result?.debug) console.log("[AAO] PDD debug:", result.debug);
  if (result?.bodyInnerText !== undefined) console.log("[AAO] PDD innerText:", result.bodyInnerText);
  if (result?.bodyTextContent !== undefined) console.log("[AAO] PDD textContent:", result.bodyTextContent);
  if (result?.htmlLen !== undefined) console.log("[AAO] PDD htmlLen:", result.htmlLen, "allEls:", result.allEls);
  if (result?.iframes?.length) console.log("[AAO] PDD iframes:", result.iframes);
  if (result?.sampleDivText !== undefined) console.log("[AAO] PDD sampleDiv:", result.sampleDivText, "style:", result.sampleDivStyle);
  return { data: result };
}

// ── Taobao extractor ──────────────────────────────────────────────
function extractTaobao() {
  const toUrl = s => s ? (s.startsWith("//") ? "https:" + s : s) : "";
  const mapAuction = i => {
    // view_price is display yuan ("199.00"). i.price may be in fen (integer cents).
    let priceStr = String(i.view_price || i.priceWap || "");
    if (!priceStr || priceStr === "0") {
      const raw = parseFloat(String(i.price || "0"));
      // If integer > 1000 with no decimal, likely fen → convert to yuan
      priceStr = (raw > 1000 && Number.isInteger(raw)) ? String(raw / 100) : String(raw || "0");
    }
    return {
      name: i.raw_title || i.title || i.name || "",
      price: priceStr,
      image: toUrl(i.pic_url || i.img || ""),
      itemUrl: toUrl(i.detail_url || i.url || ""),
      sales: i.view_sales || String(i.sold || 0),
      shop: i.nick || i.seller_nick || "淘宝卖家",
    };
  };

  // Filter out Taobao ranking-section entries and shop-name-as-title items
  const TB_LABEL = /(热销|推荐|必买|精选|榜单|第\d+名|TOP\d+)$/;
  const TB_SHOP = /旗舰店|专卖店|专营店|官方店/;
  const isRealProduct = i => i.name && i.name.length > 5 && !TB_LABEL.test(i.name.trim()) && !TB_SHOP.test(i.name);

  // Method 1: g_page_config (classic Taobao / Tmall format)
  const cfg = window.g_page_config || window.__g_page_config__;
  if (cfg) {
    const auctions = cfg?.mods?.itemlist?.data?.auctions;
    if (auctions?.length) {
      const items = auctions.slice(0, 40).map(mapAuction).filter(isRealProduct);
      if (items.length) return { source: "g_page_config", items };
    }
  }

  // Method 2: __NEXT_DATA__ (React-based new Taobao)
  const nd = document.getElementById("__NEXT_DATA__");
  if (nd?.textContent) {
    try {
      const p = JSON.parse(nd.textContent);
      const d = p?.props?.pageProps?.data || p?.props?.initialState;
      const arr = d?.itemsArray || d?.item?.itemList;
      if (arr?.length) {
        const items = arr.slice(0, 40).map(mapAuction).filter(isRealProduct);
        if (items.length) return { source: "next_data", items };
      }
    } catch {}
  }

  // Method 3: scan all window globals for product lists
  for (const key of ["pageData", "__pageData__", "tbapp", "__INITIAL_DATA__"]) {
    try {
      const g = window[key];
      if (!g) continue;
      const auctions = g?.mods?.itemlist?.data?.auctions || g?.data?.itemsArray || g?.itemsArray;
      if (auctions?.length) {
        const items = auctions.slice(0, 40).map(mapAuction).filter(isRealProduct);
        if (items.length) return { source: key, items };
      }
    } catch {}
  }

  // Method 4: scan inline <script> tags for embedded JSON with auctions
  for (const s of document.querySelectorAll("script")) {
    const txt = s.textContent || "";
    if (!txt.includes("raw_title") && !txt.includes("pic_url")) continue;
    // Match "auctions":[...] array
    const m = txt.match(/"auctions"\s*:\s*(\[[\s\S]*?\}])/);
    if (m) {
      try {
        const arr = JSON.parse(m[1]);
        if (arr?.length) {
          const items = arr.slice(0, 40).map(mapAuction).filter(isRealProduct);
          if (items.length) return { source: "script_auctions", items };
        }
      } catch {}
    }
  }

  // Method 5: DOM card extraction
  const cards = Array.from(document.querySelectorAll(
    "[data-item-id], [class*='doubleCardWrapper'], [class*='CardWrapper'], [class*='item-card'], " +
    "[class*='itemCard'], .m-itemlist-item, .J_MouserOnverReq, " +
    "div[class*='item'][data-id], div[class*='card'][class*='item'], " +
    "[class*='ResultCard'], [class*='result-card'], [class*='SearchCard']"
  )).slice(0, 40);

  if (!cards.length) {
    return { source: "error", error: "需要登录淘宝或无数据", url: location.href };
  }

  const items = cards.map(card => {
    const img = card.querySelector("img");
    const link = card.querySelector("a");
    const texts = [];
    const walk = n => {
      if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) texts.push(t); }
      else n.childNodes.forEach(walk);
    };
    walk(card);
    const priceStr = texts.find(t => /^¥[\d,]+\.?\d*$/.test(t.trim()))
      || texts.find(t => /^\d{1,5}(\.\d{1,2})?$/.test(t.trim()) && parseFloat(t) >= 1 && parseFloat(t) < 100000)
      || "0";
    const LABEL_NOISE = /^(热销|推荐|必买|精选|爆款|新品|特惠|入选|榜单|第\d+名|TOP\d)|(热销|推荐|必买|精选|榜单)$/;
    const SHOP_NOISE = /旗舰店|专卖店|专营店|官方店|卖家|品牌店/;
    const name = texts.find(t =>
      t.length > 8 && !t.includes("¥") && !/^\d/.test(t) &&
      !/^[+\d,元件万]+$/.test(t) && !LABEL_NOISE.test(t) && !SHOP_NOISE.test(t)
    ) || "";
    const salesStr = texts.find(t => /\d+[\+人]?销售|已售\d+|付款|人付款/.test(t)) || "";
    const rawPrice = parseFloat(priceStr.replace(/[^\d.]/g, "") || "0");
    // If DOM price is an integer > 1000, likely in fen → convert to yuan
    const price = (rawPrice > 1000 && Number.isInteger(rawPrice)) ? String(rawPrice / 100) : String(rawPrice || "0");
    return {
      name,
      price,
      image: img?.getAttribute("data-src") || img?.src || "",
      itemUrl: link?.href || "",
      sales: salesStr.replace(/[^0-9]/g, "") || "0",
      shop: card.querySelector("[class*='shop']")?.textContent?.trim() || "淘宝卖家",
    };
  }).filter(i => i.name && parseFloat(i.price) > 0);

  return { source: "dom", items };
}

// ── Pinduoduo extractor ───────────────────────────────────────────
function extractPDD() {
  const walk = n => {
    if (n.nodeType === 3) { const t = n.textContent.trim(); if (t) return [t]; return []; }
    return Array.from(n.childNodes).flatMap(walk);
  };

  // Strategy 1: global JS data
  for (const key of ["__hybrid_init_data__", "rawData", "serverData", "__NEXT_DATA__", "pdddata"]) {
    try {
      const g = window[key];
      if (!g) continue;
      const str = typeof g === "string" ? g : JSON.stringify(g);
      if (!str.includes("goods_id") && !str.includes("goods_name")) continue;
      const p = typeof g === "object" ? g : JSON.parse(str);
      const list = p?.data?.list || p?.props?.pageProps?.serverData?.goods_list || p?.list;
      if (list?.length) {
        return { source: "global", items: list.slice(0, 40).map(i => ({
          name: i.goods_name || i.name || "",
          price: String((i.min_group_price || i.min_normal_price || i.price || 0) / 100),
          image: i.goods_img || i.image || "",
          itemUrl: `https://mobile.yangkeduo.com/goods.html?goods_id=${i.goods_id}`,
          sales: String(i.sales_tip || i.sold_quantity || 0),
          shop: i.mall_name || "拼多多商家",
        })) };
      }
    } catch {}
  }

  // Dismiss QR code / app-download overlay if present
  try {
    const overlay = document.querySelector("[class*='qrCode'], [class*='QrCode'], [class*='download'], [class*='Download'], [class*='guide'], [class*='Guide'], [class*='modal'], [class*='Modal'], [class*='popup'], [class*='Popup']");
    if (overlay) overlay.remove();
    // Also try clicking any close button
    const closeBtn = document.querySelector("[class*='close'], [class*='Close'], [aria-label*='close']");
    if (closeBtn) closeBtn.click();
  } catch {}

  // Strategy 2: <a> links containing an <img> (works with hashed class names)
  const allLinks = Array.from(document.querySelectorAll("a"));
  const linksWithImg = allLinks.filter(a => a.querySelector("img"));
  const productLinks = linksWithImg.filter(a => {
    const href = a.href || "";
    return href.includes("goods") || href.includes("yangkeduo") || href.includes("pinduoduo") || href.includes("detail") || href.includes("item");
  });

  // Also try divs/sections with img (PDD may use onClick divs, not <a> tags)
  const divCards = Array.from(document.querySelectorAll("div, li, section")).filter(el => {
    const childCount = el.querySelectorAll("*").length;
    return el.querySelector("img") && childCount >= 5 && childCount <= 80;
  }).slice(0, 50);

  let debugInfo = `links:${allLinks.length} linksWithImg:${linksWithImg.length} productLinks:${productLinks.length} divCards:${divCards.length} sampleHrefs:${linksWithImg.slice(0,3).map(a=>a.href).join("|")}`;

  if (productLinks.length >= 3) {
    const seen = new Set();
    const items = productLinks.slice(0, 40).map(a => {
      const key = a.href;
      if (seen.has(key)) return null;
      seen.add(key);
      const img = a.querySelector("img");
      // Walk up to find a bigger container with price/name
      let container = a;
      for (let i = 0; i < 4; i++) { if (!container.parentElement) break; container = container.parentElement; }
      const texts = walk(container);
      // Price: prefer ¥-prefixed or number 1–9999, also handle split "¥"+"12"+".50"
      const priceTokens = texts.filter(t => /^[\d.]+$/.test(t) && parseFloat(t) >= 1 && parseFloat(t) < 10000);
      const priceYuan = texts.find(t => /^¥?\d{1,5}$/.test(t.trim()));
      const priceCents = texts.find(t => /^\.\d{2}$/.test(t.trim()));
      let price = "0";
      if (priceYuan && priceCents) {
        price = String(parseFloat(priceYuan.replace("¥","")) + parseFloat(priceCents));
      } else if (priceYuan) {
        price = priceYuan.replace("¥","");
      } else if (priceTokens.length) {
        price = priceTokens[0];
      }
      const name = texts.find(t => t.length > 6 && !/^[¥\d,.+万元件%折]+$/.test(t) && !/^(已售|付款|人|满|减|券)/.test(t)) || "";
      const salesStr = texts.find(t => /万?\+?人付款|已售|付款/.test(t)) || "";
      return {
        name,
        price,
        image: img?.getAttribute("data-src") || img?.src || "",
        itemUrl: a.href,
        sales: salesStr.replace(/[^0-9万]/g, "").replace("万","0000") || "0",
        shop: "拼多多商家",
      };
    }).filter(i => i && i.name && parseFloat(i.price) > 0);
    if (items.length >= 2) return { source: "link_anchor", items };
  }

  // Strategy 3: find product title ELEMENTS (8+ Chinese chars total in combined text, no img inside, short)
  const badgeRx = /^(商品发货地|综合|品牌|价格|筛选|全部|百亿|大促|最近|热销|已售|付款|好评超|评分|旗舰店|官方|发货|立减|立享|即将|拼多多|已拼|未发货|秒退|先用后付|放心购|假一赔|正品保障|退货|运费险|满意|好评率|券后|已抢|限[\d]件)/;

  const titleEls = Array.from(document.querySelectorAll("div,p,span,h1,h2,h3,li")).filter(el => {
    if (el.querySelector("img")) return false;  // no img inside title
    const txt = (el.textContent || "").replace(/\s+/g, "");
    const chCnt = (txt.match(/[一-龥]/g) || []).length;
    return chCnt >= 8 && txt.length >= 8 && txt.length <= 80
      && !badgeRx.test(txt)
      && !/%同款/.test(txt)
      && !txt.endsWith("商品")
      && !/券后|秒退|已拼|已抢|限\d件|扫码|App打开|下载App/.test(txt);
  });

  if (titleEls.length >= 2) {
    // Map imgSrc → best item (shortest clean name)
    const imgMap = new Map();
    for (const titleEl of titleEls) {
      const name = (titleEl.textContent || "").replace(/\s+/g, " ").trim();
      let container = titleEl;
      let img = null, price = "0";
      for (let i = 0; i < 5; i++) {
        if (!container.parentElement) break;
        container = container.parentElement;
        const candidateImg = container.querySelector("img");
        if (candidateImg) {
          const src = candidateImg.getAttribute("data-src") || candidateImg.src || "";
          if (src && src.includes("pddpic")) { img = candidateImg; }
        }
        if (price === "0") {
          const pm = (container.textContent || "").match(/[¥￥](\d{1,5}(?:\.\d{1,2})?)/);
          if (pm) price = pm[1];
        }
        if (img && parseFloat(price) > 0) break;
      }
      if (!img || parseFloat(price) <= 0) continue;
      const imgSrc = img.getAttribute("data-src") || img.src || "";
      if (!imgSrc) continue;
      const ctTxt = container.textContent || "";
      const salesMatch = ctTxt.match(/已抢([\d.]+万?\+?)/);
      const sales = salesMatch ? salesMatch[1].replace("万", "0000") : "0";
      // Prefer the product's own goods_id link over a generic search link
      const goodsA = container.querySelector('a[href*="goods_id="], a[href*="goods.html"], a[href*="goods1.html"], a[href*="goods2.html"]');
      const gm = (goodsA?.getAttribute("href") || "").match(/goods_id=(\d+)/);
      const itemUrl = gm ? `https://mobile.yangkeduo.com/goods.html?goods_id=${gm[1]}`
        : (goodsA?.href || `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(name)}`);
      const item = { name, price, image: imgSrc, itemUrl, sales, shop: "拼多多商家" };
      // Keep shortest name per product image
      if (!imgMap.has(imgSrc) || name.length < imgMap.get(imgSrc).name.length) {
        imgMap.set(imgSrc, item);
      }
    }
    const items = Array.from(imgMap.values()).filter(i => parseFloat(i.price) > 0);

    if (items.length >= 2) return { source: "titleel", items };
  }

  // Fallback: divCards with price text
  const pricePattern = /[¥￥]\d|\b\d{1,5}(\.\d{1,2})?\b/;
  const productDivCards = divCards.filter(el => {
    const txt = (el.textContent || "").replace(/\s+/g, " ");
    return pricePattern.test(txt) && txt.length > 10 && txt.length < 600
      && !/^(商品发货地|综合|品牌|价格|筛选|全部|百亿|大促|最近|热销)/.test(txt.trim());
  });
  if (productDivCards.length >= 2) {
    const seenImgs2 = new Set();
    const items2 = productDivCards.slice(0, 40).map(card => {
      const img = card.querySelector("img");
      const imgSrc = img?.getAttribute("data-src") || img?.src || "";
      if (!imgSrc || seenImgs2.has(imgSrc)) return null;
      seenImgs2.add(imgSrc);
      const texts = walk(card);
      const priceFull = texts.find(t => /^[¥￥]\d{1,5}(\.\d{1,2})?$/.test(t.trim()) && parseFloat(t.replace(/[¥￥]/,"")) >= 1);
      const priceNum = texts.find(t => /^\d{1,5}(\.\d{1,2})?$/.test(t.trim()) && parseFloat(t) >= 1 && parseFloat(t) < 10000);
      const price = priceFull ? priceFull.replace(/[¥￥,]/g,"") : (priceNum || "0");
      if (parseFloat(price) <= 0) return null;
      const goodsA2 = card.querySelector('a[href*="goods_id="], a[href*="goods.html"]') || card.closest('a[href*="goods_id="]');
      const gm2 = (goodsA2?.getAttribute?.("href") || goodsA2?.href || "").match(/goods_id=(\d+)/);
      const itemUrl2 = gm2 ? `https://mobile.yangkeduo.com/goods.html?goods_id=${gm2[1]}` : (goodsA2?.href || "https://mobile.yangkeduo.com/");
      return { name: "拼多多商品", price, image: imgSrc, itemUrl: itemUrl2, sales: "0", shop: "拼多多商家" };
    }).filter(i => i && parseFloat(i.price) > 0);
    if (items2.length >= 2) return { source: "divcard", items: items2 };
  }

  return { source: "error", error: "无法提取拼多多数据", url: location.href, title: document.title,
    debug: debugInfo };
}

// ── 1688 extractor ────────────────────────────────────────────────
function extract1688() {
  // PRIMARY (2026-06): 1688's new React results only PAINT card text for on-screen
  // cards, but React keeps every offer's data in its fiber tree regardless. Read the
  // fiber directly — works even in a background popup where nothing visually renders.
  // NOTE: requires running in the MAIN world (fiber expandos aren't visible in isolated).
  try {
    const cleanN = s => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const isOffer = o => o && typeof o === "object" && !Array.isArray(o) && (o.offerId || o.id) && (o.title || o.subject || o.simpleSubject || o.offerTitle);
    const offersMap = new Map();
    const sampleTitles = [];
    const priceDbg = [];
    const addOffer = (o) => {
      const id = String(o.offerId || o.id);
      if (offersMap.has(id)) return;
      const name = cleanN(o.title || o.subject || o.simpleSubject || o.offerTitle);
      if (name && sampleTitles.length < 5) sampleTitles.push(name.slice(0, 30));
      // Accept ANY language — 1688 serves ENGLISH product names to the extension window
      // (was requiring Chinese, which dropped every English title → 0 products).
      if (!name || name.replace(/\s/g, "").length < 3) return;
      // Price: try each candidate field and use the FIRST that yields a real number.
      // (English page leaves priceInteger EMPTY and puts the price in showbPrice/price —
      // the old `!= null` short-circuit picked the empty priceInteger and failed.)
      const num = (v) => { const p = parseFloat(String(v == null ? "" : v).replace(/[^\d.]/g, "")); return p > 0 ? p : 0; };
      // priceInfo.price is the actual displayed unit price (confirmed on the live page);
      // showbPrice is often the string "false" or a wholesale/shared value — try it last.
      let priceN = num(o.priceInfo && (o.priceInfo.price || o.priceInfo.showPrice));
      if (!priceN && o.priceInteger != null && String(o.priceInteger).trim() !== "") priceN = num(String(o.priceInteger) + (o.priceDecimal != null ? String(o.priceDecimal) : ""));
      if (!priceN) priceN = num(o.price) || num(o.showbPrice) || (Array.isArray(o.quantityPrices) && o.quantityPrices[0] ? num(o.quantityPrices[0].price || o.quantityPrices[0].value) : 0);
      if (!priceN) { const pm = JSON.stringify(o).match(/"price"\s*:\s*"?([\d]+\.?\d*)"?/i); if (pm) priceN = num(pm[1]); }
      if (priceDbg.length < 3 && name) priceDbg.push({ n: name.slice(0, 10), pi: o.priceInfo && o.priceInfo.price, p: o.price, sb: o.showbPrice, pInt: o.priceInteger });
      const price = String(priceN);
      if (!(priceN > 0)) {
        if (priceDbg.length < 2) priceDbg.push(Object.keys(o).filter(k => /pric|amount|money|cost|\$/i.test(k)).join(",") || ("KEYS:" + Object.keys(o).slice(0, 14).join(",")));
        return;
      }
      let image = o.offerPicUrl || o.imgUrl || o.image || "";
      if (!image) { try { const m = JSON.stringify(o).match(/(https?:)?\/\/[^"\\]*?(alicdn|cbu01)[^"\\]*?\.(jpg|jpeg|png|webp)/i); if (m) image = m[0].replace(/^\/\//, "https://"); } catch {} }
      offersMap.set(id, {
        name: name.slice(0, 120), price, image,
        itemUrl: "https://detail.1688.com/offer/" + id + ".html",
        sales: String(o.bookedCount || o.saleCount || o.tradeCount || 0).replace(/[^\d]/g, "") || "0",
        shop: (o.shopData && (o.shopData.companyName || o.shopData.name)) || "1688卖家",
        shopAge: 12,
      });
    };
    const scan = (o, d) => {
      if (!o || typeof o !== "object" || d > 5) return;
      if (isOffer(o)) { addOffer(o); return; }
      if (Array.isArray(o)) { for (const v of o) scan(v, d + 1); return; }
      for (const k in o) {
        if (k[0] === "_" || k === "return" || k === "stateNode" || k === "child" || k === "sibling" || k === "alternate" || k === "dependencies" || k === "updateQueue") continue;
        try { scan(o[k], d + 1); } catch {}
      }
    };
    const el = document.querySelector('a[href*="offerId"]:not([href*="similar_search"])') || document.querySelector('a[href*="offerId"]');
    if (el) {
      const allKeys = Object.keys(el);
      const fk = allKeys.find(k => k.startsWith("__reactInternalInstance") || k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
      if (fk) {
        let root = el[fk];
        while (root.return) root = root.return;
        let n = 0;
        (function tr(f) { if (!f || n > 15000) return; n++; try { if (f.memoizedProps) scan(f.memoizedProps, 0); } catch {} tr(f.child); tr(f.sibling); })(root);
        const items = [...offersMap.values()].slice(0, 40);
        if (items.length >= 1) return { source: "react_fiber", items, dbg: { fiberNodes: n, offers: items.length, priceDbg } };
        return { source: "fiber_none", items: [], dbg: { hasFiberKey: true, fiberNodes: n, sampleTitles, priceDbg } };
      }
      // element found but NO react fiber expando → React didn't hydrate in this window
      return { source: "fiber_nokey", items: [], dbg: { elFound: true, expandoKeys: allKeys.filter(k => k[0] === "_").slice(0, 6) } };
    }
  } catch (e) { return { source: "fiber_err", items: [], err: String(e && e.message).slice(0, 90) }; }

  // Helper: normalise an offer item to our schema
  function mapOffer(i) {
    return {
      name: (i.subject || i.title || i.name || "").replace(/\s*标题链接[^，。！\n]*$/g, "").trim(),
      price: String(i.priceInfo?.price || i.price || i.quotePrice || "0"),
      image: i.imgUrl || i.image || "",
      itemUrl: i.detailUrl || i.url || `https://detail.1688.com/offer/${i.offerId || i.id}.html`,
      sales: String(i.tradeCount || i.saleCount || 0),
      shop: i.company?.name || i.sellerLogin || "1688卖家",
      shopAge: i.company?.businessYear ? i.company.businessYear * 12 : 12,
    };
  }

  // Exhaustive search of window globals — 1688 changes variable names across versions.
  // Prioritise search-result lists over recommended/promoted lists.
  function findOfferList(obj, depth) {
    if (!obj || typeof obj !== "object" || depth > 6) return null;
    if (Array.isArray(obj)) {
      if (obj.length > 0 && (obj[0]?.offerId || obj[0]?.subject || obj[0]?.title)) return obj;
      return null;
    }
    // Prefer keys that look like search results
    const preferKeys = ["offerList", "data", "result", "searchResult", "items", "list"];
    for (const k of preferKeys) {
      if (obj[k]) {
        const found = findOfferList(obj[k], depth + 1);
        if (found?.length >= 3) return found;
      }
    }
    for (const k of Object.keys(obj)) {
      if (preferKeys.includes(k)) continue;
      const found = findOfferList(obj[k], depth + 1);
      if (found?.length >= 3) return found;
    }
    return null;
  }

  // Comprehensive scan: find ANY window variable with product data (offerId+subject+imgUrl)
  const p4pOfferIds = new Set();
  for (const key of Object.keys(window)) {
    try {
      if (["document","window","location","history","chrome","performance","console","navigator","screen"].includes(key)) continue;
      const val = window[key];
      if (!val || typeof val !== "object") continue;
      const str = JSON.stringify(val);
      if (str.length > 500000 || str.length < 50) continue;
      // Collect P4P offer IDs so we can skip them in DOM fallback
      if (/p4p|topspot|topspot|sponsored/i.test(key)) {
        const ids = str.match(/"offerId"\s*:\s*"?(\d+)"?/g) || [];
        ids.forEach(m => { const id = m.replace(/\D/g,""); if(id) p4pOfferIds.add(id); });
        continue;
      }
      if ((str.includes('"offerId"') || str.includes('"subject"')) && str.includes('"imgUrl"')) {
        const list = Array.isArray(val) ? val : findOfferList(val, 0);
        if (list?.length >= 3) {
          console.log("[extract1688] Found product list in window." + key + ", count=" + list.length);
          return { source: "global:" + key, items: list.slice(0, 20).map(mapOffer) };
        }
      }
    } catch {}
  }
  console.log("[extract1688] No window var found, P4P IDs to skip:", p4pOfferIds.size);

  // DOM fallback — scroll to trigger lazy-loading of organic results, then extract.
  // 1688 redesigned its results page (2026): product links are now
  // detail.m.1688.com/...?offerId=123 (or ?offerId= params), NOT the old
  // detail.1688.com/offer/123.html. We group by offerId and support both.
  window.scrollTo(0, 1200);
  window.scrollTo(0, 2400);
  window.scrollTo(0, 0);
  {
    const dbg = { total: 0, offers: 0, noName: 0, noPrice: 0, names: [] };
    const priceRe = /[¥￥]\s*([\d,]+\.?\d{0,2})/;   // ≤2 decimals → "¥4.70" not "¥4.701个"
    const isProd = (a) => /offerId=|detail\.1688\.com|\/offer\//.test(a.href) && !/similar_search/.test(a.href);
    const offerIdOf = (a) => {
      const h = a.href || "";
      const m = h.match(/offerId=(\d+)/) || h.match(/\/offer\/(\d+)/) || h.match(/detail\.1688\.com\/[^?]*?(\d{6,})/);
      return m ? m[1] : "";
    };
    const allLinks = Array.from(
      document.querySelectorAll('a[href*="offerId"], a[href*="detail.1688.com"], a[href*="/offer/"]')
    ).filter(isProd);
    dbg.total = allLinks.length;

    // A product has several links (image, title, buy…) that share one offerId.
    const byId = new Map();
    for (const a of allLinks) {
      const id = offerIdOf(a);
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(a);
    }
    dbg.offers = byId.size;

    // UI noise 1688 mixes into card text, plus price/quantity-tier fragments
    const NOISE = /找相似|旺旺在线|综合服务|采购咨询|验厂报告|退换体验|品质体验|物流时效|纠纷解决|回头率|先采后付|退货包运费|加入采购车|立即订购|复购|成交|人付款|问大家|广告|包邮|起批/;
    const cleanName = (s) => (s || "")
      .replace(/[¥￥]\s*[\d,]+\.?\d*/g, "")
      .replace(/≥?\d+个|~\d+|\d+\+/g, "")
      .replace(/[｜|·]/g, " ")
      .replace(/\s+/g, " ").trim();

    const candidates = [];
    for (const [id, links] of byId) {
      // Card = largest ancestor still wrapping ONLY this offerId (never sibling products)
      let card = links[0];
      let node = links[0].parentElement;
      for (let i = 0; i < 12 && node; i++) {
        const ids = new Set(
          Array.from(node.querySelectorAll('a[href*="offerId"], a[href*="detail.1688.com"], a[href*="/offer/"]'))
            .filter(isProd).map(offerIdOf).filter(Boolean)
        );
        if (ids.size > 1) break;   // going higher would merge neighbouring products
        card = node;
        node = node.parentElement;
      }

      // Name = longest clean Chinese text in the card that isn't UI noise
      let name = "";
      for (const e of card.querySelectorAll("div, span, p, a")) {
        const t = (e.textContent || "").replace(/\s+/g, " ").trim();
        if (t.length >= 6 && t.length <= 70 && /[一-龥]{4,}/.test(t) && !NOISE.test(t)) {
          const c = cleanName(t);
          if (c.length > name.length && c.length >= 4) name = c;
        }
      }
      if (!name) { const im0 = card.querySelector("img"); name = cleanName(im0?.alt || ""); }
      name = name.slice(0, 120);

      const pm = card.textContent.match(priceRe);
      const price = pm ? pm[1].replace(/,/g, "") : "0";
      const img = card.querySelector("img");
      const imgSrc = img?.src || img?.getAttribute("data-src") || img?.getAttribute("data-lazy-src") || "";
      const salesMatch = card.textContent.match(/(\d[\d,]*)\s*(笔|件|成交|sold)/i);
      const sales = salesMatch ? salesMatch[1].replace(/,/g, "") : "0";

      if (!name) { dbg.noName++; continue; }
      if (parseFloat(price) <= 0) { dbg.noPrice++; continue; }
      candidates.push({ name, price, image: imgSrc, itemUrl: "https://detail.1688.com/offer/" + id + ".html", sales, shop: "1688卖家", shopAge: 12 });
    }
    dbg.names = candidates.slice(0, 12).map((p) => p.name.slice(0, 24));

    // Drop the topspot ad carousel: it repeats ONE product (same name+image) many times.
    const sig = (p) => p.name.slice(0, 40).toLowerCase() + "|" + (p.image || "").split("?")[0];
    const usedSig = new Set(), products = [];
    for (const p of candidates) {
      const s = sig(p);
      if (usedSig.has(s)) continue;
      usedSig.add(s);
      products.push(p);
      if (products.length >= 40) break;
    }
    if (products.length >= 3) return { source: "dom_offerid", items: products, dbg };
    window.__aao1688dbg = dbg;

    // Last resort: scan script tags for embedded JSON
    for (const s of document.querySelectorAll("script")) {
      const txt = s.textContent || "";
      if (!txt.includes("offerList") && !txt.includes('"subject"')) continue;
      const m = txt.match(/\{[\s\S]{500,}\}/);
      if (!m) continue;
      try {
        const p = JSON.parse(m[0]);
        const list = p?.offerList || p?.data?.offerList;
        if (list?.length) {
          return {
            source: "script_json",
            items: list.slice(0, 20).map(i => ({
              name: (i.subject || i.title || "").replace(/\s*标题链接[^，。！\n]*$/g, "").trim(),
              price: String(i.priceInfo?.price || i.price || "0"),
              image: i.imgUrl || i.image || "",
              itemUrl: i.detailUrl || `https://detail.1688.com/offer/${i.offerId}.html`,
              sales: String(i.tradeCount || 0),
              shop: i.company?.name || "1688卖家",
              shopAge: 12,
            })),
          };
        }
      } catch {}
    }
    return { source: "error", error: "无法提取1688数据", url: location.href, dbg: (typeof window.__aao1688dbg !== "undefined" ? window.__aao1688dbg : null) };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "shopee_tab_data" || message.type === "lazada_tab_data") {
    const tabId = sender.tab?.id;
    if (!tabId) return false;
    const pending = pendingSearches.get(tabId);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    pendingSearches.delete(tabId);
    chrome.tabs.remove(tabId).catch(() => {});
    pending.resolve({ data: message.data });
    return false;
  }

  if (message.type === "shopee_search") {
    // sortBy=sales → Shopee returns TOP-SELLING items first. Shopee hides the raw
    // sold numbers, but still sorts by real sales server-side, so this surfaces
    // products that actually sell (more of them have reviews/favorites = real
    // demand data) instead of the default "relevancy" mix full of brand-new,
    // zero-engagement dropship listings that all read "数据不足". Better for 选品.
    const url = `https://shopee.com.my/search?keyword=${encodeURIComponent(message.keyword)}&sortBy=sales`;
    console.log("[AAO] Opening Shopee tab:", message.keyword);
    searchViaTab(url)
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === "lazada_search") {
    const url = `https://www.lazada.com.my/catalog/?q=${encodeURIComponent(message.keyword)}`;
    console.log("[AAO] Opening Lazada tab:", message.keyword);
    searchLazadaViaTab(url)
      .then((r) => sendResponse(r))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  if (message.type === "taobao_search") {
    const cached = getCached("taobao", message.keyword);
    if (cached) { sendResponse({ data: cached }); return true; }
    const url = `https://s.taobao.com/search?q=${encodeURIComponent(message.keyword)}`;
    console.log("[AAO] Opening Taobao tab:", message.keyword);
    alibabaGate()
      .then(() => scrapeTaobaoWithScroll(url))
      .then((r) => { setCached("taobao", message.keyword, r?.data); sendResponse(r); })
      .catch((e) => sendResponse({ data: null }));
    return true;
  }

  if (message.type === "pdd_search") {
    const cached = getCached("pdd", message.keyword);
    if (cached) { sendResponse({ data: cached }); return true; }
    const url = `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(message.keyword)}`;
    console.log("[AAO] Opening PDD tab:", message.keyword);
    searchPDDViaTab(url)
      .then((r) => { setCached("pdd", message.keyword, r?.data); sendResponse(r); })
      .catch((e) => sendResponse({ data: null }));
    return true;
  }

  if (message.type === "pdd_data") {
    // Accumulate batches from pdd-bridge.js; resolve with the biggest batch received
    const tab = sender.tab;
    if (!tab) return false;
    const pending = pendingPDD.get(tab.id);
    if (pending) {
      const newItems = message.data?.items || [];
      console.log("[AAO] PDD batch received:", newItems.length, "items (total so far:", (pending.items?.length || 0) + newItems.length, ")");
      if (!pending.items) pending.items = [];
      // Deduplicate by itemUrl
      const seen = new Set(pending.items.map(i => i.itemUrl));
      for (const item of newItems) {
        if (item.itemUrl && !seen.has(item.itemUrl)) {
          seen.add(item.itemUrl);
          pending.items.push(item);
        }
      }
      // If we have enough items already, resolve early
      if (pending.items.length >= 20) {
        clearTimeout(pending.timeout);
        pendingPDD.delete(tab.id);
        chrome.windows.remove(tab.windowId).catch(() => {});
        pending.resolve({ data: { source: "api_accumulated", items: pending.items } });
      }
    }
    return false;
  }

  // 1688 content script sends API results (like PDD)
  if (message.type === "1688_data") {
    const tab = sender.tab;
    if (!tab) return false;
    const pending = pending1688.get(tab.id);
    if (pending) {
      const newItems = message.data?.items || [];
      console.log("[AAO] 1688 batch:", newItems.length, "items");
      if (!pending.items) pending.items = [];
      const seen = new Set(pending.items.map(i => i.itemUrl));
      for (const item of newItems) {
        if (item.itemUrl && !seen.has(item.itemUrl)) { seen.add(item.itemUrl); pending.items.push(item); }
      }
      if (pending.items.length >= 10) {
        clearTimeout(pending.timeout);
        pending1688.delete(tab.id);
        chrome.windows.remove(tab.windowId).catch(() => {});
        pending.resolve({ data: { source: "api", items: pending.items } });
      }
    }
    return false;
  }

  if (message.type === "1688_search") {
    const cached = getCached("1688", message.keyword);
    if (cached) { sendResponse({ data: cached }); return true; }
    console.log("[AAO] 1688 form-search keyword:", message.keyword);
    alibabaGate()
      .then(() => search1688ViaForm(message.keyword))
      .then((r) => { setCached("1688", message.keyword, r?.data); sendResponse(r); })
      .catch(() => sendResponse({ data: null }));
    return true;
  }

  if (message.type === "tb_image_search") {
    console.log("[AAO] Taobao image search requested");
    searchByTaobaoImage(message.imageDataUrl)
      .then((keyword) => sendResponse({ data: { keyword } }))
      .catch(() => sendResponse({ data: { keyword: null } }));
    return true;
  }

  if (message.type === "1688_image_search") {
    console.log("[AAO] 1688 image search (找同款) requested");
    search1688ByImage(message.imageDataUrl)
      .then((r) => sendResponse(r))
      .catch(() => sendResponse({ data: null }));
    return true;
  }

  return false;
});

// ── 1688 keyword simplification ──────────────────────────────────────
// 1688 search works best with a concise Chinese product term.
// Full queries like "新款全自动搅拌杯tritan便携式健身运" cause 1688 to return
// promoted "tritan" water bottles instead of actual search results.
function simplify1688Keyword(keyword) {
  // Remove English/numeric words
  let result = keyword.replace(/[a-zA-Z0-9]+/g, "");
  // Remove known generic modifier terms
  const generics = ["新款", "全新", "便携式", "大容量", "高颜值", "多功能", "耐高温", "健身运", "式健身", "携式健", "户外用"];
  for (const g of generics) result = result.replace(new RegExp(g, "g"), "");
  result = result.replace(/\s+/g, "").trim();
  // Must keep at least 2 Chinese chars; fall back to original if too short
  return result.length >= 2 ? result : keyword;
}

// ── 1688 search via injected GBK form ────────────────────────────────
async function search1688ViaForm(keyword) {
  return new Promise((resolve) => {
    const masterTimeout = setTimeout(() => { console.log("[AAO] 1688 master timeout"); resolve({ data: null }); }, 55000);

    // Distill Taobao-style long titles into the short keywords 1688's wholesale
    // search actually matches well (see distillCnKeyword).
    const kw = distillCnKeyword(keyword);
    if (kw !== keyword) console.log("[AAO] 1688 keyword distilled:", keyword, "→", kw);
    // 1688 honours &charset=utf8 → keywords can be plain UTF-8 percent-encoded.
    // This avoids the GBK form-submit dance and loads the results page in ONE navigation.
    const url = "https://s.1688.com/selloffer/offer_search.htm?keywords="
      + encodeURIComponent(kw) + "&charset=utf8";
    console.log("[AAO] 1688 opening:", url.slice(0, 110));

    chrome.windows.create(
      // Background popup — 1688's new React results use virtualized rendering (only the
      // few cards in-viewport have text; off-screen cards are empty), so a full scrape
      // isn't reliably possible. Keep it quiet: unfocused, no focus-stealing.
      { url, type: "popup", width: randInt(1180, 1360), height: randInt(820, 960), focused: false },
      (win) => {
        const tabId = win.tabs[0].id;
        const winId = win.id;
        let safetyNet;
        const cleanup = () => { clearTimeout(masterTimeout); clearTimeout(safetyNet); chrome.windows.remove(winId).catch(() => {}); };
        // Cancel our own timeouts while the user is completing a verification wall,
        // so we don't resolve/close the popup out from under them.
        const cancelTimers = () => { clearTimeout(masterTimeout); clearTimeout(safetyNet); };
        let done = false;

        // Check the loaded page for the "unusual traffic" anti-bot wall.
        const checkAntiBot = async () => {
          try {
            const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: detectAntiBot });
            return !!result?.antiBot;
          } catch { return false; }
        };

        const doExtract = async () => {
          if (done) return; done = true;
          try {
            if (await checkAntiBot()) {
              const passed = await promptUserVerification(winId, tabId, undefined, cancelTimers);
              if (!passed) { cleanup(); resolve({ data: { source: "anti_bot", antiBot: true, items: [] } }); return; }
              // user passed → fall through and extract the real results
            }
            const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: extract1688 });
            console.log("[AAO] 1688 extract:", JSON.stringify(result)?.slice(0, 220));
            cleanup(); resolve({ data: result });
          } catch (e) { console.log("[AAO] 1688 extract err:", e?.message); cleanup(); resolve({ data: null }); }
        };

        // Progressively scroll the offer grid to trigger lazy-loading of more products.
        // Randomized pauses make the access pattern less bot-like (avoids 异常流量 wall).
        const scrollThenExtract = async () => {
          clearTimeout(safetyNet); // we're extracting now — don't let the safety-net timer race the poll
          await humanDelay(3000, 1500);
          // Verification wall on load → surface it to the user, wait, then continue
          if (await checkAntiBot()) {
            const passed = await promptUserVerification(winId, tabId, undefined, cancelTimers);
            if (!passed) {
              if (done) return; done = true;
              cleanup(); resolve({ data: { source: "anti_bot", antiBot: true, items: [] } });
              return;
            }
            // user passed → continue to scroll + extract below
          }
          // Read products from React's fiber (extract1688 in MAIN world) — works in a
          // quiet BACKGROUND popup, no focus-stealing needed. A light scroll nudges the
          // grid to mount more offer cards into the fiber tree; then poll a few times.
          if (done) return;
          const sweep = async () => {
            for (const y of [randInt(1500, 2200), randInt(5000, 6500), randInt(9000, 11000), 0]) {
              if (done) return;
              try { await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: (t) => window.scrollTo({ top: t, behavior: "smooth" }), args: [y] }); } catch {}
              await humanDelay(650, 400);
            }
          };
          let best = null;
          // Was 8s/2 attempts, but slow renders were returning 0 items. Polling
          // only re-reads the already-open page (no new requests), so a longer
          // window costs nothing in ban risk.
          const deadline = Date.now() + 15000;
          for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
            if (done) return;
            await sweep();
            await humanDelay(1500, 800); // let name/price finish rendering
            try {
              const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: extract1688 });
              const n = result?.items?.length || 0;
              console.log("[AAO] 1688 poll", attempt, "items:", n, "src:", result?.source, "dbg:", JSON.stringify(result?.dbg));
              if (n) best = result;
              if (n >= 3) { done = true; cleanup(); resolve({ data: result }); return; }
            } catch (e) {
              console.log("[AAO] 1688 poll err:", e?.message);
              if (/No tab|No window/i.test(e?.message || "")) { done = true; return; } // popup gone — stop
            }
          }
          if (done) return;
          done = true; cleanup();
          resolve({ data: best || { source: "empty", items: [] } });
        };

        const onUpdated = (tid, info) => {
          if (tid !== tabId || info.status !== "complete") return;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.tabs.get(tabId, (tab) => console.log("[AAO] 1688 results URL:", (tab?.url || "").slice(0, 120)));
          scrollThenExtract();
        };
        chrome.tabs.onUpdated.addListener(onUpdated);

        // Safety net: if 'complete' never fires, extract anyway
        safetyNet = setTimeout(() => { chrome.tabs.onUpdated.removeListener(onUpdated); doExtract(); }, 30000);
      }
    );
  });
}

// ── 1688 image search (找同款) ───────────────────────────────────────
// Open 1688's image-search page, inject the user's image into its file input,
// let 1688's own JS upload it + navigate to results, then scrape with extract1688.
// Returns { source, items, antiBot, dbg } so the frontend can show products directly.
async function search1688ByImage(imageDataUrl) {
  if (!imageDataUrl) return { data: null };
  console.log("[AAO] 1688 image search: starting");

  return new Promise((resolve) => {
    let winId = null, tabId = null;
    let phase = "loading"; // loading -> injecting -> injected -> results
    let settled = false;
    const cleanup = () => { if (winId != null) chrome.windows.remove(winId).catch(() => {}); };
    const finish = (data) => {
      if (settled) return; settled = true;
      clearTimeout(master); cleanup(); resolve({ data });
    };
    const master = setTimeout(() => { console.log("[AAO] 1688 image: master timeout"); finish({ source: "img_timeout", items: [] }); }, 50000);

    // Inject the image file into 1688's file input and trigger its uploader.
    // No trigger-clicking (that can pop a native file dialog in the popup).
    const injectFile = async () => {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: async (dataUrl) => {
            const dataURLtoFile = (durl, name) => {
              const [head, b64] = durl.split(",");
              const mime = (head.match(/:(.*?);/) || [])[1] || "image/jpeg";
              const bin = atob(b64); let n = bin.length; const u8 = new Uint8Array(n);
              while (n--) u8[n] = bin.charCodeAt(n);
              return new File([u8], name, { type: mime });
            };
            const file = dataURLtoFile(dataUrl, "search.jpg");

            let inputs = Array.from(document.querySelectorAll('input[type="file"]'));
            // If none present, gently click image-search triggers to reveal one, then retry
            if (!inputs.length) {
              const triggerSel = '[class*="camera" i],[class*="pailitao" i],[class*="img-search" i],[class*="imageSearch" i],[class*="paitu" i]';
              document.querySelectorAll(triggerSel).forEach((el) => { try { el.click(); } catch {} });
              await new Promise((r) => setTimeout(r, 600));
              inputs = Array.from(document.querySelectorAll('input[type="file"]'));
            }
            const inputInfo = inputs.map((i) => (i.className || i.id || i.accept || "input").slice(0, 40));
            let dispatched = 0;
            for (const input of inputs) {
              try {
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                input.dispatchEvent(new Event("change", { bubbles: true }));
                input.dispatchEvent(new Event("input", { bubbles: true }));
                // Some uploaders bind onchange as a property — call it directly too
                if (typeof input.onchange === "function") {
                  try { input.onchange({ target: input, currentTarget: input, type: "change" }); } catch {}
                }
                dispatched++;
              } catch {}
            }
            return { ok: dispatched > 0, fileInputs: inputs.length, inputInfo, url: location.href, title: document.title.slice(0, 60) };
          },
          args: [imageDataUrl],
        });
        console.log("[AAO] 1688 image inject:", JSON.stringify(result));
        return result;
      } catch (e) {
        console.log("[AAO] 1688 image inject err:", e?.message);
        return { ok: false, err: e?.message };
      }
    };

    // Count offer links currently on the page (cheap probe to know when results rendered)
    const countOffers = async () => {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => document.querySelectorAll('a[href*="detail.1688.com"], a[href*="/offer/"]').length,
        });
        return result || 0;
      } catch { return 0; }
    };

    const doFinalExtract = async (reason) => {
      console.log("[AAO] 1688 image: final extract (", reason, ")");
      for (const y of [1400, 3600, 6200, 8800]) {
        try { await chrome.scripting.executeScript({ target: { tabId }, func: (t) => window.scrollTo({ top: t, behavior: "smooth" }), args: [y] }); } catch {}
        await humanDelay(1100, 700);
      }
      try {
        const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: extract1688 });
        console.log("[AAO] 1688 image results:", JSON.stringify(result)?.slice(0, 200));
        finish(result || { source: "img_empty", items: [] });
      } catch (e) {
        console.log("[AAO] 1688 image extract err:", e?.message);
        finish({ source: "img_error", items: [] });
      }
    };

    // Inspect the cropper to see whether our injected image actually loaded into it.
    // (Empty imageId in the results URL means we confirmed before the image loaded.)
    const inspectCropper = async () => {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const cont = document.querySelector('[class*="croper" i], [class*="cropper" i], [class*="imgCroper" i]');
            const scope = cont || document;
            const els = Array.from(scope.querySelectorAll('img, canvas'));
            const imgs = els.slice(0, 6).map((el) => ({
              tag: el.tagName.toLowerCase(),
              nw: el.naturalWidth || el.width || 0,
              src: (el.currentSrc || el.src || el.getAttribute('src') || '').slice(0, 28),
            }));
            return { hasCropper: !!cont, imgs };
          },
        });
        return result;
      } catch { return { hasCropper: false, imgs: [] }; }
    };

    // After upload 1688 shows an image CROPPER with Confirm/Cancel. Click Confirm
    // (class croperBtn + ok) to frame the product and actually run the image search.
    const clickCropConfirm = async () => {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const clicked = [];
            // Preferred: the cropper OK button — class contains "croperBtn" and "ok" (not "cancel")
            let btns = Array.from(document.querySelectorAll('[class*="croperBtn" i], [class*="croper" i] span, [class*="croper" i] button'))
              .filter((el) => /ok/i.test(el.className || "") && !/cancel/i.test(el.className || ""));
            // Fallback: an exact Confirm/确定/确认 button (NOT 搜索 — that hijacks to keyword search)
            if (!btns.length) {
              btns = Array.from(document.querySelectorAll('button, span, div, a')).filter((el) => {
                const t = (el.textContent || "").trim();
                return t.length <= 4 && /^(确定|确认|Confirm|OK)$/i.test(t);
              });
            }
            for (const el of btns) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) {
                try { el.click(); clicked.push(((el.className || "").toString().slice(0, 30)) || (el.textContent || "").trim()); } catch {}
              }
            }
            return { clicked };
          },
        });
        console.log("[AAO] 1688 crop-confirm click:", JSON.stringify(result));
        return result;
      } catch (e) { return { clicked: [] }; }
    };

    // Diagnostic: dump visible short-text buttons near the top so we can find
    // the real image-search trigger if auto-search doesn't kick in.
    const dumpClickables = async () => {
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const out = [];
            for (const el of document.querySelectorAll('button, a, [role="button"], div, span')) {
              const r = el.getBoundingClientRect();
              if (r.width < 8 || r.height < 8 || r.top < 0 || r.top > 800) continue;
              const txt = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
              if (!txt || txt.length > 14) continue;
              const cls = (el.className && el.className.toString) ? el.className.toString().slice(0, 36) : "";
              out.push(txt + " [" + el.tagName.toLowerCase() + "." + cls + "]");
              if (out.length >= 36) break;
            }
            return { url: location.href.slice(0, 110), buttons: out };
          },
        });
        console.log("[AAO] 1688 image clickables:", JSON.stringify(result));
      } catch (e) { console.log("[AAO] 1688 image dump err:", e?.message); }
    };

    // Poll for results — 1688 uploads the image then renders results (often in-place).
    // We do NOT click the generic keyword Search (that hijacks to a keyword query).
    const pollForResults = async () => {
      for (let i = 0; i < 16; i++) {
        if (settled) return;
        await humanDelay(2000, 0);
        if (i <= 3) await clickCropConfirm();  // click the cropper's Confirm (may render late)
        if (i === 4) await dumpClickables();   // diagnostic if still nothing
        // anti-bot wall?
        try {
          const [{ result: ab }] = await chrome.scripting.executeScript({ target: { tabId }, func: detectAntiBot });
          if (ab?.antiBot) { finish({ source: "anti_bot", antiBot: true, items: [] }); return; }
        } catch {}
        // nudge lazy-load
        try { await chrome.scripting.executeScript({ target: { tabId }, func: () => window.scrollTo(0, 2600) }); } catch {}
        const offers = await countOffers();
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        const url = (tab?.url || "");
        console.log("[AAO] 1688 image poll", i, "offers:", offers, "url:", url.slice(0, 90));
        // Ignore a keyword-search page (wrong path) — only accept image / youyuan results
        const isKeywordPage = /offer_search\.htm\?keywords=/i.test(url);
        if (offers >= 3 && !isKeywordPage) { await doFinalExtract("poll-hit"); return; }
      }
      await doFinalExtract("poll-timeout");
    };

    // 1688 image-search landing page (shows an upload box / accepts injected file)
    const entryUrl = "https://s.1688.com/youyuan/index.htm";
    chrome.windows.create({ url: entryUrl, type: "popup", width: 1280, height: 900, focused: false }, (win) => {
      winId = win.id; tabId = win.tabs[0].id;

      chrome.tabs.onUpdated.addListener(async function listener(tid, info) {
        if (tid !== tabId || info.status !== "complete") return;
        if (phase !== "loading") return; // only act on the first full load; polling handles the rest
        phase = "injected";
        chrome.tabs.onUpdated.removeListener(listener);
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        console.log("[AAO] 1688 image loaded url=", (tab?.url || "").slice(0, 100));
        await humanDelay(1800, 700);
        await injectFile();
        // Wait for our image to actually LOAD into the cropper before confirming —
        // confirming an empty cropper produces an empty imageId (no results).
        let cropLoaded = false;
        for (let k = 0; k < 10; k++) {
          await humanDelay(800, 0);
          const ci = await inspectCropper();
          console.log("[AAO] 1688 cropper state", k, JSON.stringify(ci));
          if (ci?.imgs?.some((x) => x.nw > 10)) { cropLoaded = true; break; }
        }
        console.log("[AAO] 1688 cropper image loaded:", cropLoaded);
        await clickCropConfirm();    // confirm the crop → runs the image search
        await pollForResults();
      });
    });
  });
}

// ── 1688 background fetch (no popup, uses session cookies) ───────────
async function fetch1688Background(keyword) {
  const url = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(keyword)}`;
  try {
    const resp = await fetch(url, {
      credentials: "include",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://www.1688.com/",
        "Cache-Control": "no-cache",
      },
    });
    if (!resp.ok) { console.log("[AAO] 1688 fetch status:", resp.status); return { data: null }; }
    const html = await resp.text();
    console.log("[AAO] 1688 HTML length:", html.length);

    function mapOffer(i) {
      return {
        name: (i.subject || i.title || i.name || "").replace(/\s*标题链接[^，。！\n]*$/g, "").trim(),
        price: String(i.priceInfo?.price || i.price || i.quotePrice || "0"),
        image: i.imgUrl || i.image || "",
        itemUrl: i.detailUrl || i.url || `https://detail.1688.com/offer/${i.offerId || i.id}.html`,
        sales: String(i.tradeCount || i.saleCount || 0),
        shop: i.company?.name || i.sellerLogin || "1688卖家",
        shopAge: i.company?.businessYear ? i.company.businessYear * 12 : 12,
      };
    }
    function findOffers(obj, depth) {
      if (!obj || typeof obj !== "object" || depth > 8) return null;
      if (Array.isArray(obj)) {
        if (obj.length > 1 && (obj[0]?.offerId || obj[0]?.subject)) return obj;
        return null;
      }
      for (const k of ["offerList", "data", "result", "searchResult", "items", "list", "offers"]) {
        if (obj[k]) { const f = findOffers(obj[k], depth + 1); if (f?.length > 1) return f; }
      }
      for (const v of Object.values(obj)) {
        if (typeof v === "object") { const f = findOffers(v, depth + 1); if (f?.length > 1) return f; }
      }
      return null;
    }

    // Scan all script tags for JSON blobs containing 1688 offer data
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    const candidates = [];
    while ((m = scriptRe.exec(html)) !== null) {
      const txt = m[1];
      if (!txt.includes("offerId") && !txt.includes("subject") && !txt.includes("offerList")) continue;
      // Extract the largest JSON-like object from this script
      const jsonRe = /\{[\s\S]{200,}\}/g;
      let jm;
      while ((jm = jsonRe.exec(txt)) !== null) {
        try {
          const parsed = JSON.parse(jm[0]);
          const offers = findOffers(parsed, 0);
          if (offers?.length > 1) candidates.push(offers);
        } catch {}
      }
    }

    // Pick the candidate with the most items (likely the actual search results)
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.length - a.length);
      const items = candidates[0].slice(0, 20).map(mapOffer).filter(i => i.name && parseFloat(i.price) > 0);
      console.log("[AAO] 1688 fetch found", items.length, "items from HTML");
      if (items.length > 0) return { data: { source: "fetch_html", items } };
    }

    // Also try window variable assignments like: window.__xxx__ = {...}
    const winVarRe = /window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(\{[\s\S]{200,}\})\s*;/g;
    while ((m = winVarRe.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(m[2]);
        const offers = findOffers(parsed, 0);
        if (offers?.length > 1) {
          const items = offers.slice(0, 20).map(mapOffer).filter(i => i.name && parseFloat(i.price) > 0);
          if (items.length > 0) {
            console.log("[AAO] 1688 window var", m[1], "found", items.length, "items");
            return { data: { source: "fetch_window:" + m[1], items } };
          }
        }
      } catch {}
    }

    console.log("[AAO] 1688 fetch: no offers found in HTML");
    return { data: null };
  } catch (e) {
    console.error("[AAO] 1688 fetch error:", e);
    return { data: null };
  }
}

// ── Taobao image search (拍立淘) via sessionStorage ─────────────────
async function searchByTaobaoImage(imageDataUrl) {
  if (!imageDataUrl) return null;
  console.log("[AAO] TB image search: starting");

  const r1 = Math.floor(Math.random() * 800) + 100;
  const r2 = Math.floor(Math.random() * 800) + 100;
  const r3 = Math.floor(Math.random() * 800) + 100;
  const key = `localImgSearchKey1_782_${r1}_${r2}_${r3}`;
  const searchUrl = `https://s.taobao.com/search?ie=utf8&localImgKey=${key}&search_type=item&spm=a21bo.jianhua%252Fa.search_image.image_search_button&tab=all`;

  return new Promise((resolve) => {
    let tabId = null;
    let phase = "init";

    const cleanup = () => { if (tabId) chrome.tabs.remove(tabId).catch(() => {}); };

    const timeout = setTimeout(() => {
      console.log("[AAO] TB image search: timeout");
      cleanup();
      resolve(null);
    }, 45000); // room for the human-like scroll (frontend waits 50s)

    // active:true so Taobao fully renders (background tabs may lazy-load)
    chrome.tabs.create({ url: "https://s.taobao.com/", active: true }, (tab) => {
      tabId = tab.id;
      console.log("[AAO] TB image search: tab created", tabId);

      chrome.tabs.onUpdated.addListener(async function listener(tId, info) {
        if (tId !== tabId || info.status !== "complete") return;

        // info.url is not always populated — query the tab directly
        const tabInfo = await chrome.tabs.get(tabId).catch(() => null);
        const tabUrl = tabInfo?.url || info.url || "";
        console.log("[AAO] TB image search: tab updated phase=", phase, "url=", tabUrl.slice(0, 80));

        if (phase === "init" && tabUrl.includes("taobao.com")) {
          // Set phase BEFORE executeScript to avoid race with next onUpdated
          phase = "navigating";
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              func: (k, dataUrl, url) => {
                sessionStorage.setItem(k, dataUrl);
                location.href = url;
              },
              args: [key, imageDataUrl, searchUrl],
            });
            console.log("[AAO] TB image search: sessionStorage set, navigating");
          } catch (e) {
            console.log("[AAO] TB image search: executeScript failed", e.message);
            chrome.tabs.onUpdated.removeListener(listener);
            clearTimeout(timeout);
            cleanup();
            resolve(null);
          }
          return;
        }

        if (phase === "navigating" && tabUrl.includes("localImgKey")) {
          phase = "extracting";
          chrome.tabs.onUpdated.removeListener(listener);
          console.log("[AAO] TB image search: results page loaded");

          // Let results start rendering, then browse like a human — random
          // up/down scrolling (different every run) so the visit doesn't look
          // like a fixed load→read→close robot pattern. Also mounts more
          // result cards, giving the name vote below more titles to work with.
          await new Promise(r => setTimeout(r, randInt(2500, 4000)));
          await humanScroll(tabId, "MAIN");

          try {
            const res = await chrome.scripting.executeScript({
              target: { tabId },
              world: "MAIN",
              func: () => {
                // Method 1: g_page_config (classic Taobao embedded JSON — most reliable)
                try {
                  const cfg = window.g_page_config;
                  const auctions = cfg?.mods?.itemlist?.data?.auctions;
                  if (auctions && auctions.length > 0) {
                    return auctions.slice(0, 10).map(a => a.raw_title || a.title || "").filter(Boolean);
                  }
                } catch(e) {}

                // Method 2: __NEXT_DATA__ (newer React format)
                try {
                  const nd = window.__NEXT_DATA__;
                  if (nd) {
                    const matches = JSON.stringify(nd).match(/"raw_title":"([^"]{5,60})"/g);
                    if (matches && matches.length > 0) {
                      return matches.slice(0, 10).map(m => m.replace(/^"raw_title":"/, "").replace(/"$/, ""));
                    }
                  }
                } catch(e) {}

                // Method 3: Scan script tags for raw_title (embedded JSON)
                try {
                  for (const s of document.querySelectorAll("script")) {
                    const t = s.textContent || "";
                    if (t.includes('"raw_title"') && (t.includes('"auctions"') || t.includes('"items"'))) {
                      const m = t.match(/"raw_title":"([^"]{5,60})"/g);
                      if (m && m.length > 0) {
                        return m.slice(0, 10).map(s2 => s2.replace(/^"raw_title":"/, "").replace(/"$/, ""));
                      }
                    }
                  }
                } catch(e) {}

                // Method 4: Product card title elements (targeted, not broad span/a)
                const titles = [];
                const seen = new Set();
                const UI_NOISE = /淘宝|天猫|首页|登录|购物车|收藏|我的|客服|帮助|活动|订单|评价|退款|付款|交易|账户|余额|积分|消息|设置|红包|优惠|领券|售后|猜你|查看全部|更多|热门|电商|学习|中心|直播|拍立淘|宝贝|已买|购买/;
                for (const el of document.querySelectorAll('[class*="item"] [class*="title"], [class*="card"] [class*="title"], [class*="product"] [class*="name"]')) {
                  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
                  if (text.length >= 6 && text.length <= 60 && /[一-龥]{3,}/.test(text) && !UI_NOISE.test(text) && !seen.has(text)) {
                    seen.add(text); titles.push(text);
                    if (titles.length >= 10) break;
                  }
                }
                return titles;
              },
            });

            clearTimeout(timeout);
            cleanup();

            const titles = (res?.[0]?.result || []).filter(Boolean);
            console.log("[AAO] Taobao image search titles:", titles);

            if (titles.length === 0) { resolve(null); return; }

            // Majority vote: the title that shares the most words with all the
            // OTHER titles is the name the results agree on — image search top
            // hits can be off, but ten results rarely agree on a wrong name.
            const tokensOf = (t) => {
              const set = new Set();
              const zh = t.replace(/[^一-龥]/g, "");
              for (let i = 0; i + 1 < zh.length; i++) set.add(zh.slice(i, i + 2)); // Chinese bigrams
              for (const w of (t.toLowerCase().match(/[a-z0-9]{2,}/g) || [])) set.add(w); // latin words/numbers
              return set;
            };
            const tokenSets = titles.map(tokensOf);
            let bestIdx = 0, bestScore = -1;
            for (let i = 0; i < titles.length; i++) {
              let score = 0;
              for (let j = 0; j < titles.length; j++) {
                if (i === j) continue;
                for (const tok of tokenSets[i]) if (tokenSets[j].has(tok)) score++;
              }
              if (score > bestScore) { bestScore = score; bestIdx = i; } // ties → earlier (more relevant) result
            }
            const best = titles[bestIdx];
            console.log("[AAO] TB image search: majority-vote pick", bestIdx, "of", titles.length, ":", best);
            let cleaned = best
              .replace(/【[^】]{0,30}】/g, "")
              .replace(/[！!｜|★▶►]/g, " ")
              .replace(/\s+/g, " ")
              .trim();

            // Trim to 20 chars at a sensible break
            if (cleaned.length > 20) {
              cleaned = cleaned.slice(0, 20).trimEnd();
            }

            resolve(cleaned || null);
          } catch (e) {
            clearTimeout(timeout);
            cleanup();
            resolve(null);
          }
        }
      });
    });
  });
}
