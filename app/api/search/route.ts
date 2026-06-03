import { NextRequest, NextResponse } from "next/server"

// Popular tickers for autocomplete suggestions
const POPULAR: Array<{ ticker: string; name: string; sector: string }> = [
  { ticker: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Cyclical" },
  { ticker: "META", name: "Meta Platforms Inc.", sector: "Technology" },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Consumer Cyclical" },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Technology" },
  { ticker: "INTC", name: "Intel Corporation", sector: "Technology" },
  { ticker: "QCOM", name: "Qualcomm Inc.", sector: "Technology" },
  { ticker: "AVGO", name: "Broadcom Inc.", sector: "Technology" },
  { ticker: "TSM", name: "Taiwan Semiconductor", sector: "Technology" },
  { ticker: "AMAT", name: "Applied Materials", sector: "Technology" },
  { ticker: "MU", name: "Micron Technology", sector: "Technology" },
  { ticker: "MRVL", name: "Marvell Technology", sector: "Technology" },
  { ticker: "ASML", name: "ASML Holding", sector: "Technology" },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Financial Services" },
  { ticker: "BAC", name: "Bank of America", sector: "Financial Services" },
  { ticker: "GS", name: "Goldman Sachs", sector: "Financial Services" },
  { ticker: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { ticker: "LLY", name: "Eli Lilly", sector: "Healthcare" },
  { ticker: "ABBV", name: "AbbVie Inc.", sector: "Healthcare" },
  { ticker: "V", name: "Visa Inc.", sector: "Financial Services" },
  { ticker: "MA", name: "Mastercard Inc.", sector: "Financial Services" },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer Defensive" },
  { ticker: "PG", name: "Procter & Gamble", sector: "Consumer Defensive" },
  { ticker: "XOM", name: "Exxon Mobil", sector: "Energy" },
  { ticker: "CVX", name: "Chevron Corporation", sector: "Energy" },
  { ticker: "NEE", name: "NextEra Energy", sector: "Utilities" },
]

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.toUpperCase() || ""
  if (!q || q.length < 1) {
    return NextResponse.json(POPULAR.slice(0, 8))
  }

  const matches = POPULAR.filter(
    (s) => s.ticker.startsWith(q) || s.name.toUpperCase().includes(q)
  ).slice(0, 8)

  // If no local match, still return it as a custom ticker
  if (matches.length === 0 && q.length >= 1) {
    return NextResponse.json([{ ticker: q, name: q, sector: "" }])
  }

  return NextResponse.json(matches)
}
