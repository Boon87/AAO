// MAIN world — intercepts PDD search API responses
(function () {
  const _fetch = window.fetch;
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;

  function tryExtract(data) {
    if (!data || typeof data !== "object") return null;
    // Recursively look for a list with goods_id or goods_name
    function findList(obj, depth) {
      if (!obj || typeof obj !== "object" || depth > 8) return null;
      if (Array.isArray(obj)) {
        if (obj.length > 0 && (obj[0]?.goods_id || obj[0]?.goods_name || obj[0]?.name)) return obj;
        return null;
      }
      for (const v of Object.values(obj)) {
        const found = findList(v, depth + 1);
        if (found) return found;
      }
      return null;
    }
    const list = findList(data, 0);
    if (!list?.length) return null;
    const items = list.slice(0, 30).map(i => ({
      name: i.goods_name || i.name || i.goods_info?.goods_name || "",
      price: String((i.min_group_price || i.min_normal_price || i.price || 0) / 100),
      image: i.goods_img || i.goods_img_url || i.image || i.goods_thumbnail_url || "",
      itemUrl: `https://mobile.yangkeduo.com/goods.html?goods_id=${i.goods_id || i.id || ""}`,
      sales: String(i.sales_tip || i.sold_quantity || i.goods_sale_num || 0),
      shop: i.mall_name || i.shop_name || "拼多多商家",
    })).filter(i => i.name && parseFloat(i.price) > 0);
    return items.length > 0 ? items : null;
  }

  function handleResponse(text) {
    try {
      const data = JSON.parse(text);
      const items = tryExtract(data);
      if (items) {
        window.__PDD_SEARCH_RESULT__ = { source: "api", items };
        // Dispatch to ISOLATED world bridge (avoids inline-script CSP issue)
        document.dispatchEvent(new CustomEvent("__pdd_data__", {
          detail: JSON.stringify({ source: "api", items })
        }));
      }
    } catch {}
  }

  // Intercept ALL fetch requests (PDD uses various API paths)
  window.fetch = async function (...args) {
    const res = await _fetch.apply(this, args);
    try {
      res.clone().text().then(handleResponse).catch(() => {});
    } catch {}
    return res;
  };

  // Intercept ALL XHR requests
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__url__ = url;
    return _xhrOpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => { handleResponse(this.responseText); });
    return _xhrSend.apply(this, args);
  };
})();
