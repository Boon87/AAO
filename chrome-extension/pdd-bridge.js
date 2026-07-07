// ISOLATED world bridge — sends each API batch immediately; background accumulates
(function () {
  document.addEventListener("__pdd_data__", (e) => {
    try {
      const data = JSON.parse(e.detail);
      chrome.runtime.sendMessage({ type: "pdd_data", data });
    } catch {}
  });
})();
