"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { SearchBar } from "@/components/search/SearchBar"

interface WatchItem {
  ticker: string
  addedAt: string
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])

  useEffect(() => {
    const saved = localStorage.getItem("alphaview_watchlist")
    if (saved) setWatchlist(JSON.parse(saved))
  }, [])

  function remove(ticker: string) {
    const updated = watchlist.filter(w => w.ticker !== ticker)
    setWatchlist(updated)
    localStorage.setItem("alphaview_watchlist", JSON.stringify(updated))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">自选股</h1>
        <p className="text-sm text-gray-400 mt-1">本地保存。在下方搜索添加股票。</p>
      </div>

      <SearchBar />

      {watchlist.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <p className="text-gray-500 text-sm">自选股列表为空。</p>
          <p className="text-gray-600 text-xs mt-1">在上方搜索股票开始分析。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {watchlist.map(item => (
            <div key={item.ticker} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-blue-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <Link href={`/stock/${item.ticker}`} className="font-mono font-bold text-blue-400 hover:text-blue-300 transition-colors">
                  {item.ticker}
                </Link>
                <span className="text-xs text-gray-500">添加于 {new Date(item.addedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/stock/${item.ticker}`} className="px-3 py-1 text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-600/30 transition-colors">
                  分析
                </Link>
                <button onClick={() => remove(item.ticker)} className="px-3 py-1 text-xs text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/30 rounded transition-colors">
                  移除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
