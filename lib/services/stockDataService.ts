/**
 * Stock data service — FMP stable API (new endpoints, post-Aug 2025)
 * Docs: https://site.financialmodelingprep.com/developer/docs
 *
 * Financial ratios (PE, margins, ROE, etc.) come from yfinance via Python bridge
 * because FMP free tier only covers /profile.
 */
import { spawn } from "child_process"
import path from "path"
import type { StockOverview, OHLCVBar, FinancialYear, PeerStock } from "@/lib/types/stock"

const FMP  = process.env.FMP_API_KEY || ""
const BASE = "https://financialmodelingprep.com/stable"

async function fmp<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!FMP) throw new Error("FMP_API_KEY not set")
  const qs = new URLSearchParams({ ...params, apikey: FMP }).toString()
  const res = await fetch(`${BASE}${path}?${qs}`, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`FMP ${path} → HTTP ${res.status}`)
  const data = await res.json()
  if (data?.["Error Message"]) throw new Error(data["Error Message"])
  return data as T
}

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const num = Number(v)
  return isFinite(num) && num !== 0 ? num : null
}

// ─── yfinance Python bridge ────────────────────────────────────────────────
type YFinanceInfo = {
  pe_ratio: number | null; forward_pe: number | null; pb_ratio: number | null
  ps_ratio: number | null; peg_ratio: number | null; ev_ebitda: number | null
  roe: number | null; roa: number | null
  gross_margin: number | null; operating_margin: number | null; net_margin: number | null
  debt_to_equity: number | null; current_ratio: number | null
  revenue_growth: number | null; earnings_growth: number | null
  free_cashflow: number | null; dividend_yield: number | null
  target_price: number | null; eps: number | null; forward_eps: number | null
  "52w_high": number | null; "52w_low": number | null
}

function fetchYFinanceInfo(ticker: string): Promise<YFinanceInfo> {
  return new Promise((resolve) => {
    const empty: YFinanceInfo = {
      pe_ratio: null, forward_pe: null, pb_ratio: null, ps_ratio: null,
      peg_ratio: null, ev_ebitda: null, roe: null, roa: null,
      gross_margin: null, operating_margin: null, net_margin: null,
      debt_to_equity: null, current_ratio: null, revenue_growth: null,
      earnings_growth: null, free_cashflow: null, dividend_yield: null,
      target_price: null, eps: null, forward_eps: null,
      "52w_high": null, "52w_low": null,
    }
    const pythonPath = process.env.PYTHON_PATH || "python3"
    const scriptPath = path.join(process.cwd(), "scripts", "yfinance_info.py")
    const child = spawn(pythonPath, [scriptPath, ticker], { timeout: 15000 })
    let out = ""
    child.stdout.on("data", (d: Buffer) => { out += d.toString() })
    child.on("close", () => {
      try { resolve({ ...empty, ...JSON.parse(out.trim()) }) }
      catch { resolve(empty) }
    })
    child.on("error", () => resolve(empty))
  })
}

// ─── Overview ──────────────────────────────────────────────────────────────
export async function fetchOverview(ticker: string): Promise<StockOverview> {
  const sym = ticker.toUpperCase()

  type Profile = {
    symbol: string; name: string; companyName: string; price: number; marketCap: number
    beta: number; change: number; changePercentage: number; volume: number
    averageVolume: number; exchange: string
    sector: string; industry: string; website: string; description: string; fullTimeEmployees: string
  }

  const [profiles, yf] = await Promise.all([
    fmp<Profile[]>("/profile", { symbol: sym }),
    fetchYFinanceInfo(sym),
  ])

  const p = profiles?.[0] ?? {} as Partial<Profile>

  const price     = Number(p.price ?? 0)
  const changePct = Number(p.changePercentage ?? 0)

  return {
    ticker:           sym,
    company_name:     p.companyName ?? p.name ?? sym,
    exchange:         p.exchange ?? "",
    sector:           p.sector ?? "",
    industry:         p.industry ?? "",
    website:          p.website ?? "",
    description:      (p.description ?? "").slice(0, 600),
    employees:        p.fullTimeEmployees ? Number(p.fullTimeEmployees) : null,
    price,
    prev_close:       price - Number(p.change ?? 0),
    change_pct:       changePct,
    market_cap:       n(p.marketCap),
    pe_ratio:         yf.pe_ratio,
    forward_pe:       yf.forward_pe,
    pb_ratio:         yf.pb_ratio,
    ps_ratio:         yf.ps_ratio,
    peg_ratio:        yf.peg_ratio,
    ev_ebitda:        yf.ev_ebitda,
    roe:              yf.roe,
    roa:              yf.roa,
    gross_margin:     yf.gross_margin,
    operating_margin: yf.operating_margin,
    net_margin:       yf.net_margin,
    debt_to_equity:   yf.debt_to_equity,
    current_ratio:    yf.current_ratio,
    revenue_growth:   yf.revenue_growth,
    earnings_growth:  yf.earnings_growth,
    free_cashflow:    yf.free_cashflow,
    dividend_yield:   yf.dividend_yield,
    beta:             n(p.beta),
    "52w_high":       yf["52w_high"],
    "52w_low":        yf["52w_low"],
    avg_volume:       n(p.averageVolume),
    analyst_rating:   "",
    target_price:     yf.target_price,
    eps:              yf.eps,
    forward_eps:      yf.forward_eps,
  }
}

// ─── Price History (Yahoo Finance) ────────────────────────────────────────
const YF_RANGE: Record<string, string> = {
  "1d": "1d", "5d": "5d", "1mo": "1mo", "3mo": "3mo",
  "6mo": "6mo", "1y": "1y", "2y": "2y", "5y": "5y",
}
const YF_INTERVAL: Record<string, string> = {
  "1d": "5m", "5d": "15m", "1mo": "1d", "3mo": "1d",
  "6mo": "1d", "1y": "1d", "2y": "1wk", "5y": "1wk",
}

export async function fetchHistory(ticker: string, period = "1y"): Promise<OHLCVBar[]> {
  const sym      = ticker.toUpperCase()
  const range    = YF_RANGE[period]    ?? "1y"
  const interval = YF_INTERVAL[period] ?? "1d"

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=${interval}&includePrePost=false`
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Yahoo Finance chart → HTTP ${res.status}`)

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return []

  const ts    = result.timestamp as number[]
  const quote = result.indicators?.quote?.[0]
  if (!ts || !quote) return []

  return ts.map((t, i) => ({
    time:   new Date(t * 1000).toISOString().slice(0, 10),
    open:   +Number(quote.open?.[i]  ?? 0).toFixed(2),
    high:   +Number(quote.high?.[i]  ?? 0).toFixed(2),
    low:    +Number(quote.low?.[i]   ?? 0).toFixed(2),
    close:  +Number(quote.close?.[i] ?? 0).toFixed(2),
    volume: quote.volume?.[i] ?? 0,
  })).filter(b => b.close > 0)
}

// ─── yfinance financials + peers bridge ────────────────────────────────────
type YFinanceFinancials = {
  annual: FinancialYear[]
  peers:  PeerStock[]
}

function fetchYFinanceFinancials(ticker: string): Promise<YFinanceFinancials> {
  return new Promise((resolve) => {
    const empty: YFinanceFinancials = { annual: [], peers: [] }
    const pythonPath = process.env.PYTHON_PATH || "python3"
    const scriptPath = path.join(process.cwd(), "scripts", "yfinance_financials.py")
    const fmpKey     = process.env.FMP_API_KEY || ""
    const child = spawn(pythonPath, [scriptPath, ticker, fmpKey], { timeout: 30000 })
    let out = ""
    child.stdout.on("data", (d: Buffer) => { out += d.toString() })
    child.on("close", () => {
      try { resolve({ ...empty, ...JSON.parse(out.trim()) }) }
      catch { resolve(empty) }
    })
    child.on("error", () => resolve(empty))
  })
}

// ─── Financials + Peers (single Python call) ───────────────────────────────
export async function fetchFinancialsAndPeers(ticker: string): Promise<YFinanceFinancials> {
  return fetchYFinanceFinancials(ticker.toUpperCase())
}

export async function fetchFinancials(ticker: string): Promise<{ annual: FinancialYear[] }> {
  const { annual } = await fetchYFinanceFinancials(ticker.toUpperCase())
  return { annual }
}

export async function fetchPeers(ticker: string): Promise<PeerStock[]> {
  const { peers } = await fetchYFinanceFinancials(ticker.toUpperCase())
  return peers
}

// ─── Fallback quote ────────────────────────────────────────────────────────
export async function fetchFinnhubQuote(ticker: string) {
  try {
    const data = await fmp<{ price: number; changePercentage: number }[]>("/profile", { symbol: ticker })
    const d = data?.[0]
    return d ? { price: d.price, change_pct: d.changePercentage } : null
  } catch { return null }
}
