import { NextResponse } from "next/server";

export async function GET() {
  const cookie = process.env.SHOPEE_COOKIE ?? "";

  try {
    const puppeteer = (await import("puppeteer-core")).default;
    const fs = await import("fs");

    const CHROME_PATHS = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];
    const executablePath = CHROME_PATHS.find((p) => fs.existsSync(p));

    if (!executablePath) {
      return NextResponse.json({ error: "Chrome not found", paths: CHROME_PATHS });
    }

    const browser = await puppeteer.launch({
      executablePath,
      headless: false, // must be non-headless to pass Shopee's x-sap-sec check
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1366,768",
        "--window-position=-2000,0",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    // Manual stealth patches
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      // Fake chrome runtime
      // @ts-ignore
      if (!window.chrome) window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
      // Fix permissions
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (params) =>
        params.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(params);
      // Realistic plugins
      Object.defineProperty(navigator, "plugins", { get: () => [{ name: "Chrome PDF Plugin" }, { name: "Chrome PDF Viewer" }] });
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en", "zh-CN"] });
    });

    // Set cookies
    if (cookie) {
      const cookies = cookie.split(";").map((c: string) => {
        const [name, ...rest] = c.trim().split("=");
        return { name: name.trim(), value: rest.join("=").trim(), domain: ".shopee.com.my", path: "/" };
      });
      await page.setCookie(...cookies);
    }

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
    );

    // Intercept the search API response that Shopee's own JS fires
    let capturedData: string | null = null;
    let capturedStatus = 0;

    page.on("response", async (res) => {
      if (res.url().includes("/api/v4/search/search_items")) {
        capturedStatus = res.status();
        try { capturedData = await res.text(); } catch {}
      }
    });

    // Navigate to the real search page — Shopee's JS will fire the API call automatically
    await page.goto(
      "https://shopee.com.my/search?keyword=%E6%94%B6%E7%BA%B3%E7%9B%92",
      { waitUntil: "networkidle2", timeout: 30000 }
    ).catch(() => {}); // ignore navigation errors (e.g. verify page)

    // Give a bit more time if API response hasn't arrived yet
    if (!capturedData) await new Promise(r => setTimeout(r, 5000));

    await page.close();
    await browser.close();

    if (!capturedData) {
      return NextResponse.json({ error: "No API response captured — Shopee may have shown a captcha/verify page", hasCookie: cookie.length > 0 });
    }

    let parsed: unknown;
    try { parsed = JSON.parse(capturedData); } catch { parsed = null; }

    const itemCount = parsed && typeof parsed === "object" && "items" in parsed
      ? (parsed as { items: unknown[] }).items?.length ?? 0 : 0;

    return NextResponse.json({
      status: capturedStatus,
      chromePath: executablePath,
      hasCookie: cookie.length > 0,
      itemCount,
      rawPreview: capturedData.slice(0, 400),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
