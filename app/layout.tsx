import type { Metadata } from "next"
import "./globals.css"
import Link from "next/link"

export const metadata: Metadata = {
  title: "AlphaView — AI 美股投研平台",
  description: "机构级 AI 美股分析：财务报表、估值对比、产业链研究、技术面信号，一键生成投研报告。",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] antialiased">
        {/* 顶部导航栏 */}
        <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#090d18]/95 backdrop-blur-sm">
          <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-blue-400 font-bold text-lg tracking-tight">Alpha<span className="text-white">View</span></span>
              <span className="hidden sm:inline text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded uppercase tracking-wider">AI 投研</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/hot-stocks" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse inline-block" />
                今日热点
              </Link>
              <Link href="/watchlist" className="text-sm text-gray-400 hover:text-white transition-colors">
                自选股
              </Link>
            </div>
          </div>
        </nav>

        {/* 主内容区 */}
        <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
          {children}
        </main>

        {/* 页脚 */}
        <footer className="border-t border-[var(--border)] py-4 text-center">
          <p className="text-xs text-gray-600">
            AlphaView — 仅供研究参考，不构成投资建议。
            数据来源：Yahoo Finance、Finnhub、FMP、FRED。
          </p>
        </footer>
      </body>
    </html>
  )
}
