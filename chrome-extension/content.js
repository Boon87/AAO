// Content script — runs on AAO web app pages
// Bridge between the AAO web app and the background service worker

let port;
function keepAlive() {
  try {
    port = chrome.runtime.connect({ name: "keepalive" });
    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) return;
      setTimeout(keepAlive, 1000);
    });
  } catch {
    // Extension context invalidated — notify the page so it can show a reload prompt
    window.postMessage({ type: "AAO_EXTENSION_CONTEXT_LOST" }, "*");
  }
}
keepAlive();

window.postMessage({ type: "AAO_EXTENSION_READY" }, "*");

const PLATFORM_BRIDGES = [
  { msg: "AAO_SHOPEE_SEARCH",    result: "AAO_SHOPEE_RESULT",    bgType: "shopee_search"    },
  { msg: "AAO_LAZADA_SEARCH",    result: "AAO_LAZADA_RESULT",    bgType: "lazada_search"    },
  { msg: "AAO_TAOBAO_SEARCH",    result: "AAO_TAOBAO_RESULT",    bgType: "taobao_search"    },
  { msg: "AAO_PDD_SEARCH",       result: "AAO_PDD_RESULT",       bgType: "pdd_search"       },
  { msg: "AAO_1688_SEARCH",      result: "AAO_1688_RESULT",      bgType: "1688_search"      },
];

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const { type, keyword, requestId, imageDataUrl } = event.data || {};

  // Taobao image search (拍立淘)
  if (type === "AAO_TB_IMAGE_SEARCH") {
    try {
      chrome.runtime.sendMessage({ type: "tb_image_search", imageDataUrl }, (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage({ type: "AAO_TB_IMAGE_RESULT", requestId, data: null }, "*");
          return;
        }
        window.postMessage({ type: "AAO_TB_IMAGE_RESULT", requestId, data: response?.data ?? null }, "*");
      });
    } catch {
      window.postMessage({ type: "AAO_TB_IMAGE_RESULT", requestId, data: null }, "*");
    }
    return;
  }

  // 1688 image search (找同款) — returns products directly
  if (type === "AAO_1688_IMAGE_SEARCH") {
    try {
      chrome.runtime.sendMessage({ type: "1688_image_search", imageDataUrl }, (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage({ type: "AAO_1688_IMAGE_RESULT", requestId, data: null }, "*");
          return;
        }
        window.postMessage({ type: "AAO_1688_IMAGE_RESULT", requestId, data: response?.data ?? null }, "*");
      });
    } catch {
      window.postMessage({ type: "AAO_1688_IMAGE_RESULT", requestId, data: null }, "*");
    }
    return;
  }

  const bridge = PLATFORM_BRIDGES.find(b => b.msg === type);
  if (!bridge) return;

  try {
    chrome.runtime.sendMessage({ type: bridge.bgType, keyword }, (response) => {
      if (chrome.runtime.lastError) return;
      window.postMessage({
        type: bridge.result, requestId,
        data: response?.data ?? null, error: response?.error ?? null,
      }, "*");
    });
  } catch {
    // Context invalidated — silently fail, page will show extension missing warning
  }
});
