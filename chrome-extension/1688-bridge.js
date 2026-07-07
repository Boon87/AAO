// ISOLATED world bridge — relays API data from 1688-main.js to background
(function () {
  document.addEventListener("__1688_data__", (e) => {
    try {
      const data = JSON.parse(e.detail);
      chrome.runtime.sendMessage({ type: "1688_data", data });
    } catch {}
  });
})();
