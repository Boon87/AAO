// MAIN world — intercepts 1688 search API responses
(function () {
  const _fetch = window.fetch;
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;

  function tryExtract(text) {
    try {
      const data = JSON.parse(text);
      function findOffers(obj, depth) {
        if (!obj || typeof obj !== "object" || depth > 7) return null;
        if (Array.isArray(obj)) {
          if (obj.length > 2 && (obj[0]?.offerId || obj[0]?.subject)) return obj;
          return null;
        }
        // Check known 1688 paths first
        for (const k of ["offerList", "result", "data", "items", "list", "searchResult"]) {
          if (obj[k]) {
            const f = findOffers(obj[k], depth + 1);
            if (f?.length > 2) return f;
          }
        }
        for (const v of Object.values(obj)) {
          const f = findOffers(v, depth + 1);
          if (f?.length > 2) return f;
        }
        return null;
      }
      const offers = findOffers(data, 0);
      if (!offers?.length) return;
      const items = offers.slice(0, 20).map(i => ({
        name: (i.subject || i.title || i.name || "").replace(/\s*标题链接[^，。！\n]*$/g, "").trim(),
        price: String(i.priceInfo?.price || i.price || i.quotePrice || "0"),
        image: i.imgUrl || i.image || "",
        itemUrl: i.detailUrl || `https://detail.1688.com/offer/${i.offerId || i.id}.html`,
        sales: String(i.tradeCount || i.saleCount || 0),
        shop: i.company?.name || i.sellerLogin || "1688卖家",
      })).filter(i => i.name && parseFloat(i.price) > 0);
      if (items.length > 0) {
        document.dispatchEvent(new CustomEvent("__1688_data__", {
          detail: JSON.stringify({ source: "api", items })
        }));
      }
    } catch {}
  }

  window.fetch = async function (...args) {
    const res = await _fetch.apply(this, args);
    try { res.clone().text().then(tryExtract).catch(() => {}); } catch {}
    return res;
  };

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__url__ = url;
    return _xhrOpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => { tryExtract(this.responseText); });
    return _xhrSend.apply(this, args);
  };
})();
