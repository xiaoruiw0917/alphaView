/**
 * Stock data service — pure REST API, no Python bridge.
 * Primary:  Financial Modeling Prep (FMP)
 * Fallback: Finnhub (quote only)
 */
import type { StockOverview, OHLCVBar, FinancialYear, PeerStock } from "@/lib/types/stock"

const FMP   = process.env.FMP_API_KEY   || ""
const FINN  = process.env.FINNHUB_API_KEY || ""
const BASE  = "https://financialmodelingprep.com/api/v3"
const BASE4 = "https://financialmodelingprep.com/api/v4"

async function fmp<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...params, apikey: FMP }).toString()
  const res = await fetch(`${BASE}${path}?${qs}`, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`FMP ${path} → HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function fmp4<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...params, apikey: FMP }).toString()
  const res = await fetch(`${BASE4}${path}?${qs}`, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`FMP4 ${path} → HTTP ${res.status}`)
  return res.json() as Promise<T>
}

// ─── Overview ──────────────────────────────────────────────────────────────
export async function fetchOverview(ticker: string): Promise<StockOverview> {
  const sym = ticker.toUpperCase()

  // FMP profile + real-time quote in parallel
  const [profiles, quotes] = await Promise.all([
    fmp<Record<string, unknown>[]>(`/profile/${sym}`),
    fmp<Record<string, unknown>[]>(`/quote/${sym}`),
  ])

  const p = profiles?.[0] ?? {}
  const q = quotes?.[0]   ?? {}

  const price      = (q.price      as number) ?? (p.price as number) ?? 0
  const prevClose  = (q.previousClose as number) ?? price
  const changePct  = prevClose ? +((price - prevClose) / prevClose * 100).toFixed(2) : 0

  return {
    ticker:          sym,
    company_name:    (p.companyName  as string) ?? sym,
    exchange:        (p.exchangeShortName as string) ?? "",
    sector:          (p.sector       as string) ?? "",
    industry:        (p.industry     as string) ?? "",
    website:         (p.website      as string) ?? "",
    description:     ((p.description as string) ?? "").slice(0, 500),
    employees:       (p.fullTimeEmployees as number) ?? null,
    price,
    prev_close:      prevClose,
    change_pct:      changePct,
    market_cap:      (p.mktCap       as number) ?? null,
    pe_ratio:        (p.pe           as number) ?? null,
    forward_pe:      null,
    pb_ratio:        (p.priceToBook  as number) ?? null,
    ps_ratio:        null,
    peg_ratio:       null,
    ev_ebitda:       null,
    roe:             null,
    roa:             null,
    gross_margin:    null,
    operating_margin: null,
    net_margin:      null,
    debt_to_equity:  null,
    current_ratio:   null,
    revenue_growth:  null,
    earnings_growth: null,
    free_cashflow:   null,
    dividend_yield:  (p.lastDiv as number) ? (p.lastDiv as number) / price : null,
    beta:            (p.beta         as number) ?? null,
    "52w_high":      (p.range as string)?.split("-")[1] ? +((p.range as string).split("-")[1]) : null,
    "52w_low":       (p.range as string)?.split("-")[0] ? +((p.range as string).split("-")[0]) : null,
    avg_volume:      (q.avgVolume    as number) ?? null,
    analyst_rating:  (q.earningsAnnouncement as string) ? "" : "",
    target_price:    (q.priceAvg200  as number) ?? null,
    eps:             (p.eps          as number) ?? null,
    forward_eps:     null,
  }
}

// ─── Price History ─────────────────────────────────────────────────────────
const PERIOD_DAYS: Record<string, number> = {
  "1d": 1, "5d": 5, "1mo": 30, "3mo": 90,
  "6mo": 180, "1y": 365, "2y": 730, "5y": 1825,
}

export async function fetchHistory(ticker: string, period = "1y"): Promise<OHLCVBar[]> {
  const sym  = ticker.toUpperCase()
  const days = PERIOD_DAYS[period] ?? 365
  const to   = new Date()
  const from = new Date(to.getTime() - days * 86_400_000)
  const fmt  = (d: Date) => d.toISOString().slice(0, 10)

  type FmpBar = {
    date: string; open: number; high: number
    low: number; close: number; volume: number
  }
  type FmpResp = { historical?: FmpBar[] }

  const data = await fmp<FmpResp>(
    `/historical-price-full/${sym}`,
    { from: fmt(from), to: fmt(to), serietype: "line" },
  )

  return (data.historical ?? [])
    .map((b) => ({
      time:   b.date,
      open:   +b.open.toFixed(2),
      high:   +b.high.toFixed(2),
      low:    +b.low.toFixed(2),
      close:  +b.close.toFixed(2),
      volume: b.volume,
    }))
    .reverse()
}

// ─── Financials ────────────────────────────────────────────────────────────
export async function fetchFinancials(ticker: string): Promise<{ annual: FinancialYear[] }> {
  const sym = ticker.toUpperCase()

  type IncRow = { calendarYear: string; revenue: number; grossProfit: number;
    operatingIncome: number; netIncome: number; eps: number }
  type BalRow = { calendarYear: string; totalAssets: number; totalLiabilities: number;
    totalStockholdersEquity: number; totalCurrentAssets: number;
    totalCurrentLiabilities: number; totalDebt: number }
  type CfRow  = { calendarYear: string; freeCashFlow: number;
    operatingCashFlow: number; capitalExpenditure: number }

  const [inc, bal, cf] = await Promise.all([
    fmp<IncRow[]>(`/income-statement/${sym}`,  { limit: "5" }),
    fmp<BalRow[]>(`/balance-sheet-statement/${sym}`, { limit: "5" }),
    fmp<CfRow[]>(`/cash-flow-statement/${sym}`, { limit: "5" }),
  ])

  const byYear: Record<string, FinancialYear> = {}

  for (const r of inc ?? []) {
    const y = r.calendarYear
    const rev = r.revenue || 0
    const ni  = r.netIncome || 0
    const gp  = r.grossProfit || 0
    byYear[y] = {
      ...(byYear[y] ?? {}),
      year:             y,
      revenue:          rev,
      gross_profit:     gp,
      operating_income: r.operatingIncome,
      net_income:       ni,
      eps:              r.eps,
      gross_margin:     rev ? +(gp / rev).toFixed(4) : null,
      net_margin:       rev ? +(ni / rev).toFixed(4) : null,
    } as FinancialYear
  }

  for (const r of bal ?? []) {
    const y = r.calendarYear
    const a = r.totalAssets || 0
    const e = r.totalStockholdersEquity || 0
    const ni = byYear[y]?.net_income ?? 0
    byYear[y] = {
      ...byYear[y],
      year:                y,
      total_assets:        a,
      total_liabilities:   r.totalLiabilities,
      shareholders_equity: e,
      current_assets:      r.totalCurrentAssets,
      current_liabilities: r.totalCurrentLiabilities,
      total_debt:          r.totalDebt,
      roe:  e > 0 ? +(ni / e).toFixed(4) : null,
      roa:  a > 0 ? +(ni / a).toFixed(4) : null,
      debt_ratio: a ? +(r.totalLiabilities / a).toFixed(4) : null,
      current_ratio: r.totalCurrentLiabilities
        ? +(r.totalCurrentAssets / r.totalCurrentLiabilities).toFixed(2)
        : null,
    } as FinancialYear
  }

  for (const r of cf ?? []) {
    const y = r.calendarYear
    byYear[y] = {
      ...byYear[y],
      year:             y,
      free_cash_flow:   r.freeCashFlow,
      operating_cash_flow: r.operatingCashFlow,
      capex:            r.capitalExpenditure,
    } as FinancialYear
  }

  const annual = Object.values(byYear).sort((a, b) => a.year.localeCompare(b.year))
  return { annual }
}

// ─── Peers ─────────────────────────────────────────────────────────────────
export async function fetchPeers(ticker: string): Promise<PeerStock[]> {
  const sym = ticker.toUpperCase()

  type PeerResp = { peersList?: string[] }[]
  const peerData = await fmp4<PeerResp>("/stock_peers", { symbol: sym }).catch(() => [])
  const peerList: string[] = peerData?.[0]?.peersList?.slice(0, 8) ?? []

  if (peerList.length === 0) return []

  type QuoteRow = {
    symbol: string; name: string; pe: number; priceToBook: number
    eps: number; marketCap: number
  }
  const quotes = await fmp<QuoteRow[]>(`/quote/${peerList.join(",")}`)

  return (quotes ?? []).map((q) => ({
    ticker:         q.symbol,
    company_name:   q.name,
    pe_ratio:       q.pe     ?? null,
    forward_pe:     null,
    pb_ratio:       q.priceToBook ?? null,
    ps_ratio:       null,
    peg_ratio:      null,
    ev_ebitda:      null,
    net_margin:     null,
    roe:            null,
    revenue_growth: null,
    market_cap:     q.marketCap ?? null,
  }))
}

// ─── Finnhub fallback quote ────────────────────────────────────────────────
export async function fetchFinnhubQuote(ticker: string) {
  if (!FINN) return null
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINN}`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return null
    const d = await res.json()
    return { price: d.c, change_pct: d.dp, high: d.h, low: d.l, volume: d.v }
  } catch {
    return null
  }
}
