// ISOLATED world — bridges intercepted data from MAIN world to background
window.addEventListener("message", (e) => {
  if (e.data?.type !== "__AAO_SHOPEE_DATA") return;
  try {
    chrome.runtime.sendMessage({ type: "shopee_tab_data", data: e.data.data });
  } catch {}
});
