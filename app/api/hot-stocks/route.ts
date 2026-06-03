import { NextResponse } from "next/server"
import { fetchGeneralMarketNews } from "@/lib/services/newsService"
import { runNewsHotStockAgent } from "@/lib/agents/newsHotStockAgent"

// In-memory cache (resets on server restart; use Redis for production)
let hotStocksCache: { data: unknown; ts: number } | null = null
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

export async function GET() {
  if (hotStocksCache && Date.now() - hotStocksCache.ts < CACHE_TTL) {
    return NextResponse.json(hotStocksCache.data, {
      headers: { "X-Cache": "HIT" },
    })
  }

  try {
    const news = await fetchGeneralMarketNews()
    if (!news || news.length === 0) {
      return NextResponse.json({ error: "No news data available" }, { status: 503 })
    }

    const hotStocks = await runNewsHotStockAgent(news)
    const response = {
      generated_at: new Date().toISOString(),
      news_count: news.length,
      hot_stocks: hotStocks,
    }

    hotStocksCache = { data: response, ts: Date.now() }
    return NextResponse.json(response)
  } catch (e) {
    console.error("Hot stocks error:", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
