export type Platform = "shopee" | "lazada" | "tiktok" | "taobao" | "pinduoduo" | "1688";

export type AuthenticityLevel = "high" | "medium" | "low";

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  sales: number;
  reviews: number;
  rating: number;
  likes?: number; // favorites / 收藏数 — demand proxy (Shopee liked_count); sold count is hidden by platforms
  platform: Platform;
  shopName: string;
  shopAge: number; // months
  imageUrl: string;
  url: string;
  authenticityScore: number; // 0-100
  authenticityLevel: AuthenticityLevel;
  authenticityFlags: string[];
}

export interface SearchResult {
  query: string;
  products: Product[];
  marketAvgPrice: number;
  marketMinPrice: number;
  marketMaxPrice: number;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "竹制砧板 天然抗菌切菜板 厨房家用大号",
    price: 18.9,
    originalPrice: 35.0,
    sales: 12847,
    reviews: 3241,
    rating: 4.8,
    platform: "shopee",
    shopName: "厨房生活精选馆",
    shopAge: 36,
    imageUrl: "https://placehold.co/200x200/f0f9ff/1e40af?text=竹砧板",
    url: "#",
    authenticityScore: 85,
    authenticityLevel: "high",
    authenticityFlags: [],
  },
  {
    id: "2",
    name: "竹砧板切菜板家用双面防滑厨房菜板",
    price: 12.5,
    originalPrice: 12.5,
    sales: 5000,
    reviews: 12,
    rating: 4.9,
    platform: "shopee",
    shopName: "新店优惠铺",
    shopAge: 2,
    imageUrl: "https://placehold.co/200x200/fff7ed/ea580c?text=竹砧板",
    url: "#",
    authenticityScore: 22,
    authenticityLevel: "low",
    authenticityFlags: [
      "销量与评论比例异常（416:1）",
      "新店铺但销量极高（店龄 2 个月）",
      "销量为整数（5000）",
    ],
  },
  {
    id: "3",
    name: "天然竹木砧板加厚切菜板家用面板揉面板",
    price: 24.9,
    sales: 8320,
    reviews: 1890,
    rating: 4.7,
    platform: "lazada",
    shopName: "优质家居生活馆",
    shopAge: 48,
    imageUrl: "https://placehold.co/200x200/f0fdf4/16a34a?text=竹砧板",
    url: "#",
    authenticityScore: 78,
    authenticityLevel: "high",
    authenticityFlags: [],
  },
  {
    id: "4",
    name: "竹砧板超大号切菜板厨房专用防霉",
    price: 8.9,
    sales: 15000,
    reviews: 45,
    rating: 4.6,
    platform: "lazada",
    shopName: "特价清仓店",
    shopAge: 6,
    imageUrl: "https://placehold.co/200x200/fef2f2/dc2626?text=竹砧板",
    url: "#",
    authenticityScore: 18,
    authenticityLevel: "low",
    authenticityFlags: [
      "价格比市场均价低 62%",
      "销量与评论比例异常（333:1）",
      "销量为整数（15000）",
    ],
  },
  {
    id: "5",
    name: "网红竹砧板ins风切菜板厨房神器",
    price: 19.9,
    sales: 3200,
    reviews: 892,
    rating: 4.5,
    platform: "tiktok",
    shopName: "TikTok厨房好物",
    shopAge: 18,
    imageUrl: "https://placehold.co/200x200/fdf4ff/a21caf?text=竹砧板",
    url: "#",
    authenticityScore: 65,
    authenticityLevel: "medium",
    authenticityFlags: ["评分异常集中（90% 评论为 5 星）"],
  },
  {
    id: "6",
    name: "加厚竹砧板家用切肉板切水果蔬菜专用",
    price: 29.9,
    originalPrice: 45.0,
    sales: 6741,
    reviews: 1523,
    rating: 4.8,
    platform: "tiktok",
    shopName: "品质厨具旗舰",
    shopAge: 30,
    imageUrl: "https://placehold.co/200x200/eff6ff/2563eb?text=竹砧板",
    url: "#",
    authenticityScore: 82,
    authenticityLevel: "high",
    authenticityFlags: [],
  },
];

export const MOCK_SEARCH_RESULT: SearchResult = {
  query: "竹砧板",
  products: MOCK_PRODUCTS,
  marketAvgPrice: 19.2,
  marketMinPrice: 8.9,
  marketMaxPrice: 29.9,
};

export const RECENT_SEARCHES = ["竹砧板", "不锈钢锅", "收纳盒", "浴室置物架"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiktok: "TikTok Shop",
  taobao: "淘宝",
  pinduoduo: "拼多多",
  "1688": "1688",
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  shopee: "bg-orange-100 text-orange-700",
  lazada: "bg-blue-100 text-blue-700",
  tiktok: "bg-pink-100 text-pink-700",
  taobao: "bg-red-100 text-red-700",
  pinduoduo: "bg-green-100 text-green-700",
  "1688": "bg-amber-100 text-amber-700",
};
