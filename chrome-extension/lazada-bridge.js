// ISOLATED world — bridges intercepted Lazada data to background
window.addEventListener("message", (e) => {
  if (e.data?.type !== "__AAO_LAZADA_DATA") return;
  try {
    chrome.runtime.sendMessage({ type: "lazada_tab_data", data: e.data.data });
  } catch {}
});
