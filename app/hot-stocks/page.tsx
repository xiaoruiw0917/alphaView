"use client"
import { useState, useEffect } from "react"
import { HotStockCard } from "@/components/hot/HotStockCard"
import type { HotStock } from "@/lib/types/stock"
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton"

interface HotStocksResponse {
  generated_at: string
  news_count: number
  hot_stocks: HotStock[]
  error?: string
}

export default function HotStocksPage() {
  const [data, setData] = useState<HotStocksResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function fetchHotStocks() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/hot-stocks")
      const d: HotStocksResponse = await res.json()
      if (d.error) { setError(d.error); return }
      setData(d)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHotStocks() }, [])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="w-3 h-3 bg-red-400 rounded-full animate-pulse inline-block" />
            今日热点美股
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            基于最新市场新闻AI筛选。缓存15分钟。仅供参考，不构成投资建议。
          </p>
          {data && (
            <p className="text-xs text-gray-600 mt-1">
              基于 {data.news_count} 条新闻 · 更新于 {new Date(data.generated_at).toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={fetchHotStocks}
          disabled={loading}
          className="shrink-0 px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-gray-300 hover:border-blue-500/50 disabled:opacity-50 transition-all"
        >
          {loading ? "加载中..." : "↺ 刷新"}
        </button>
      </div>

      {/* Hot Score legend */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">热度评分公式</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            ["新闻热度", "30分", "热度与时效性"],
            ["来源可信度", "15分", "Reuters/Bloomberg > 0.9"],
            ["政策支持", "15分", "监管利好"],
            ["成长赛道", "15分", "长期市场空间"],
            ["财务质量", "10分", "资产负债表健康"],
            ["估值", "10分", "未过度高估"],
            ["技术面", "5分", "价格动量"],
          ].map(([label, pts, desc]) => (
            <div key={label} className="text-center">
              <div className="text-blue-400 font-bold">{pts}</div>
              <div className="text-white text-[11px]">{label}</div>
              <div className="text-gray-500 text-[10px]">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 animate-pulse">获取新闻并运行AI筛选中...</p>
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <LoadingSkeleton rows={5} height="h-4" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Hot stocks grid */}
      {data && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.hot_stocks
            .sort((a, b) => b.hot_score - a.hot_score)
            .map((stock, i) => (
              <HotStockCard key={`${stock.ticker}-${i}`} stock={stock} />
            ))}
        </div>
      )}

      {data && data.hot_stocks.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <p>今日新闻中暂未识别到热点股票。请刷新重试。</p>
        </div>
      )}

      <p className="text-xs text-center text-gray-700 pb-4">
        热点股票为AI生成的观察，不构成投资建议。
        请在做出任何投资决策前进行独立研究。
      </p>
    </div>
  )
}
