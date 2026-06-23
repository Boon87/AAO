import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "AAO 竞品分析工具",
  description: "快速比较各电商平台产品价格与销量",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
