// News service using Finnhub (primary) and NewsNow API (secondary)

interface NewsItem {
  title: string
  source: string
  published_at: string
  summary: string
  url: string
  sentiment?: string
}

const newsCache = new Map<string, { data: NewsItem[]; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function fetchMarketNews(ticker?: string): Promise<NewsItem[]> {
  const key = ticker || "market"
  const cached = newsCache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const finnhubKey = process.env.FINNHUB_API_KEY
  if (!finnhubKey) return []

  try {
    let url: string
    if (ticker) {
      const to = new Date().toISOString().slice(0, 10)
      const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${finnhubKey}`
    } else {
      url = `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`
    }

    const res = await fetch(url)
    if (!res.ok) return []
    const raw = await res.json() as Array<{ headline?: string; source?: string; datetime?: number; summary?: string; url?: string }>

    const items: NewsItem[] = raw.slice(0, 20).map((n) => ({
      title: n.headline || "",
      source: n.source || "Finnhub",
      published_at: n.datetime ? new Date(n.datetime * 1000).toISOString() : new Date().toISOString(),
      summary: n.summary || n.headline || "",
      url: n.url || "",
    }))

    newsCache.set(key, { data: items, ts: Date.now() })
    return items
  } catch {
    return []
  }
}

// Fetch news for hot-stocks feature
export async function fetchGeneralMarketNews(): Promise<NewsItem[]> {
  return fetchMarketNews()
}
