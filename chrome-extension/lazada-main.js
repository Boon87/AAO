// MAIN world — patches window.fetch to intercept Lazada catalog API response
(function () {
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await _fetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0]?.url ?? "");
      if (url.includes("/catalog/") && url.includes("ajax=true")) {
        res.clone().json().then((data) => {
          window.postMessage({ type: "__AAO_LAZADA_DATA", data }, "*");
        });
      }
    } catch {}
    return res;
  };

  // Also intercept XMLHttpRequest (Lazada sometimes uses XHR)
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__aao_url = url;
    return _open.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        if (this.__aao_url?.includes("/catalog/") && this.__aao_url?.includes("ajax=true")) {
          const data = JSON.parse(this.responseText);
          window.postMessage({ type: "__AAO_LAZADA_DATA", data }, "*");
        }
      } catch {}
    });
    return _send.apply(this, args);
  };
})();
