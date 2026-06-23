"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Lang = "zh" | "en";

const translations = {
  zh: {
    // Navbar
    nav_tool_name: "AAO 竞品分析",
    nav_dashboard: "搜索",
    nav_logout: "退出登录",
    nav_greeting: "你好",
    // Dashboard
    dash_badge: "实时比价 · 2 大平台",
    dash_title: "搜索产品，立刻对比价格",
    dash_subtitle: "输入产品名称，或直接拍照，在 Shopee、Lazada 同步搜索并分析真实性",
    dash_placeholder: "输入产品名称，例如：竹砧板、收纳盒…",
    dash_search_btn: "搜索",
    dash_platform_label: "搜索平台：",
    dash_recent: "最近搜索",
    dash_camera_search: "拍照搜索",
    dash_no_platform: "请至少选择一个平台",
    dash_stat_platforms: "覆盖平台",
    dash_stat_today: "今日搜索",
    dash_stat_suspicious: "发现可疑商品",
    dash_stat_platforms_val: "2 个",
    // Results
    res_results_for: "的搜索结果",
    res_found: "共找到",
    res_items: "件产品",
    res_avg: "市场均价",
    res_compare_btn: "对比已选",
    res_items_unit: "件",
    res_filter: "筛选",
    res_sort: "排序：",
    res_sort_relevant: "最相关",
    res_sort_price_asc: "价格：低 → 高",
    res_sort_price_desc: "价格：高 → 低",
    res_sort_sales: "销量：高 → 低",
    res_all_platforms: "全部",
    res_authenticity_all: "全部真实性",
    res_authenticity_high: "可信度高",
    res_authenticity_medium: "需留意",
    res_authenticity_low: "疑似造假",
    res_select_hint: "已选 1 件 · 再选 1 件即可对比（最多 4 件）",
    res_no_results: "找不到相关产品",
    res_no_filter: "目前的筛选条件下没有结果，试试放宽筛选",
    res_no_platform: "在已选平台上找不到",
    res_no_related: "相关的产品",
    res_tip_title: "建议",
    res_clear_filter: "清除所有筛选条件",
    res_new_search: "换一个关键词重新搜索",
    res_tip_text: "小贴士：试试更短的词，例如把「竹制菜板」改为「竹砧板」",
    res_retry: "重试",
    res_search_failed: "搜索失败，请检查网络连接后重试",
    res_extension_missing: "Shopee 需要 AAO 扩展（已安装请重载扩展并刷新页面）",
    res_re_search: "重新搜索…",
    // Compare
    cmp_title: "产品对比",
    cmp_back: "返回结果",
    cmp_no_products: "请至少选择 2 件产品进行对比",
    cmp_go_results: "返回搜索结果",
    cmp_attr_price: "价格",
    cmp_attr_sales: "销量",
    cmp_attr_reviews: "评价数",
    cmp_attr_rating: "评分",
    cmp_attr_shop: "店铺",
    cmp_attr_authenticity: "真实性",
    cmp_attr_link: "产品链接",
    cmp_visit: "前往",
    cmp_suspicious_flags: "可疑标志",
    cmp_no_flags: "无可疑",
    // Product card
    card_sales: "销量",
    card_reviews: "条评价",
    card_authenticity_high: "可信度高",
    card_authenticity_medium: "需留意",
    card_authenticity_low: "疑似造假",
    card_select: "选择对比",
    card_selected: "已选中",
    card_no_sales: "暂无数据",
    // Image search modal
    img_title: "拍照识别产品",
    img_take_photo: "拍照",
    img_upload: "上传图片",
    img_recognize: "识别产品",
    img_identifying: "识别中…",
    img_identified: "已识别：",
    img_failed: "识别失败，请重试",
    img_unrecognized: "无法识别此产品",
    img_cancel: "取消",
    // Auth
    login_title: "员工登录",
    login_email: "电子邮件",
    login_password: "密码",
    login_btn: "登录",
    login_signing_in: "登录中…",
    login_no_account: "还没有账号？",
    login_signup_link: "注册",
    signup_title: "员工注册",
    signup_name: "姓名",
    signup_email: "电子邮件",
    signup_password: "密码",
    signup_confirm: "确认密码",
    signup_btn: "注册",
    signup_signing_up: "注册中…",
    signup_have_account: "已有账号？",
    signup_login_link: "登录",
    signup_success: "注册成功！请检查邮件完成验证。",
  },
  en: {
    // Navbar
    nav_tool_name: "AAO Price Tool",
    nav_dashboard: "Search",
    nav_logout: "Logout",
    nav_greeting: "Hello",
    // Dashboard
    dash_badge: "Live Prices · 2 Platforms",
    dash_title: "Search Products, Compare Prices Instantly",
    dash_subtitle: "Enter a product name or take a photo to search Shopee & Lazada and check authenticity",
    dash_placeholder: "Enter product name, e.g. bamboo cutting board, storage box…",
    dash_search_btn: "Search",
    dash_platform_label: "Platforms:",
    dash_recent: "Recent Searches",
    dash_camera_search: "Photo Search",
    dash_no_platform: "Please select at least one platform",
    dash_stat_platforms: "Platforms",
    dash_stat_today: "Today's Searches",
    dash_stat_suspicious: "Suspicious Items Found",
    dash_stat_platforms_val: "2",
    // Results
    res_results_for: "results for",
    res_found: "Found",
    res_items: "products",
    res_avg: "Market avg",
    res_compare_btn: "Compare Selected",
    res_items_unit: "items",
    res_filter: "Filter",
    res_sort: "Sort:",
    res_sort_relevant: "Most Relevant",
    res_sort_price_asc: "Price: Low → High",
    res_sort_price_desc: "Price: High → Low",
    res_sort_sales: "Sales: High → Low",
    res_all_platforms: "All",
    res_authenticity_all: "All Authenticity",
    res_authenticity_high: "High Trust",
    res_authenticity_medium: "Caution",
    res_authenticity_low: "Suspicious",
    res_select_hint: "1 selected · Select 1 more to compare (max 4)",
    res_no_results: "No products found",
    res_no_filter: "No results with current filters, try relaxing them",
    res_no_platform: "No results for",
    res_no_related: "on selected platforms",
    res_tip_title: "Suggestions",
    res_clear_filter: "Clear all filters",
    res_new_search: "Try a different keyword",
    res_tip_text: "Tip: Try shorter keywords, e.g. \"bamboo board\" instead of \"bamboo cutting board\"",
    res_retry: "Retry",
    res_search_failed: "Search failed, please check your connection and retry",
    res_extension_missing: "Shopee requires the AAO extension (if installed, reload it and refresh page)",
    res_re_search: "Search again…",
    // Compare
    cmp_title: "Compare Products",
    cmp_back: "Back to Results",
    cmp_no_products: "Please select at least 2 products to compare",
    cmp_go_results: "Back to Search Results",
    cmp_attr_price: "Price",
    cmp_attr_sales: "Sales",
    cmp_attr_reviews: "Reviews",
    cmp_attr_rating: "Rating",
    cmp_attr_shop: "Shop",
    cmp_attr_authenticity: "Authenticity",
    cmp_attr_link: "Product Link",
    cmp_visit: "Visit",
    cmp_suspicious_flags: "Suspicious Flags",
    cmp_no_flags: "None",
    // Product card
    card_sales: "Sales",
    card_reviews: "reviews",
    card_authenticity_high: "High Trust",
    card_authenticity_medium: "Caution",
    card_authenticity_low: "Suspicious",
    card_select: "Select",
    card_selected: "Selected",
    card_no_sales: "No data",
    // Image search modal
    img_title: "Identify Product via Photo",
    img_take_photo: "Take Photo",
    img_upload: "Upload Image",
    img_recognize: "Identify Product",
    img_identifying: "Identifying…",
    img_identified: "Identified: ",
    img_failed: "Identification failed, please try again",
    img_unrecognized: "Could not identify this product",
    img_cancel: "Cancel",
    // Auth
    login_title: "Staff Login",
    login_email: "Email",
    login_password: "Password",
    login_btn: "Login",
    login_signing_in: "Signing in…",
    login_no_account: "Don't have an account?",
    login_signup_link: "Sign up",
    signup_title: "Staff Registration",
    signup_name: "Full Name",
    signup_email: "Email",
    signup_password: "Password",
    signup_confirm: "Confirm Password",
    signup_btn: "Register",
    signup_signing_up: "Registering…",
    signup_have_account: "Already have an account?",
    signup_login_link: "Login",
    signup_success: "Registration successful! Please check your email to verify.",
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;

interface LangContextType {
  lang: Lang;
  toggle: () => void;
  t: (key: TranslationKey) => string;
}

const LangContext = createContext<LangContextType>({
  lang: "zh",
  toggle: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("aao_lang") as Lang | null;
    if (saved === "en" || saved === "zh") setLang(saved);
  }, []);

  const toggle = () => {
    setLang((prev) => {
      const next = prev === "zh" ? "en" : "zh";
      localStorage.setItem("aao_lang", next);
      return next;
    });
  };

  const t = (key: TranslationKey): string => translations[lang][key] ?? key;

  return <LangContext.Provider value={{ lang, toggle, t }}>{children}</LangContext.Provider>;
}

export function useLanguage() {
  return useContext(LangContext);
}
