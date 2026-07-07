// MAIN world — patches window.fetch to intercept Shopee search API + shop info
(function () {
  const _fetch = window.fetch;

  // Store shop info keyed by shopid so we can enrich search results
  const shopInfoMap = {};

  // Also intercept shop info API responses
  window.fetch = async function (...args) {
    const res = await _fetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0]?.url ?? "");

      // Intercept shop get API (called by product cards on hover / page load)
      if (url.includes("/api/v4/shop/get") || url.includes("/api/v2/shop/get_shop_base")) {
        res.clone().json().then((data) => {
          const shop = data?.data ?? data;
          if (shop?.shopid) {
            shopInfoMap[shop.shopid] = {
              name: shop.name || shop.shop_name || shop.username || "",
              ctime: shop.ctime || 0, // unix timestamp of shop creation
            };
          }
        }).catch(() => {});
      }

      if (url.includes("/api/v4/search/search_items")) {
        res.clone().json().then(async (data) => {
          // Gather unique shopids from results
          const items = data?.items ?? [];
          const shopIds = [...new Set(
            items.map(i => i.item_basic?.shopid).filter(Boolean)
          )];

          // Fetch shop info for all shopids we don't have yet
          if (shopIds.length > 0) {
            await Promise.allSettled(
              shopIds
                .filter(id => !shopInfoMap[id])
                .map(id =>
                  _fetch(`https://shopee.com.my/api/v4/shop/get?shopid=${id}&need_info=1`)
                    .then(r => r.json())
                    .then(d => {
                      const shop = d?.data ?? d;
                      if (shop?.shopid || shop?.name) {
                        shopInfoMap[id] = {
                          name: shop.name || shop.shop_name || shop.username || "",
                          ctime: shop.ctime || 0,
                        };
                      }
                    })
                    .catch(() => {})
                )
            );
          }

          // Enrich items with shop info
          const enriched = {
            ...data,
            items: items.map(item => {
              const b = item.item_basic ?? item;
              const shopInfo = shopInfoMap[b.shopid] ?? {};
              return {
                ...item,
                item_basic: {
                  ...b,
                  _shop_name: shopInfo.name || "",
                  _shop_ctime: shopInfo.ctime || 0,
                },
              };
            }),
          };

          window.postMessage({ type: "__AAO_SHOPEE_DATA", data: enriched }, "*");
        }).catch(() => {
          // Fallback: send original data without enrichment
          window.postMessage({ type: "__AAO_SHOPEE_DATA", data }, "*");
        });
      }
    } catch {}
    return res;
  };
})();
