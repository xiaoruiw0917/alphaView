/**
 * Stock data service — FMP stable API (new endpoints, post-Aug 2025)
 * Docs: https://site.financialmodelingprep.com/developer/docs
 */
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

// ─── Overview ──────────────────────────────────────────────────────────────
export async function fetchOverview(ticker: string): Promise<StockOverview> {
  const sym = ticker.toUpperCase()

  type Profile = {
    symbol: string; name: string; price: number; marketCap: number
    beta: number; change: number; changePercentage: number; volume: number
    averageVolume: number; yearHigh: number; yearLow: number
    exchange: string; range: string
  }
  type RatiosTTM = {
    priceToEarningsRatioTTM: number; priceToEarningsGrowthRatioTTM: number
    forwardPriceToEarningsGrowthRatioTTM: number; priceToBookRatioTTM: number
    priceToSalesRatioTTM: number; priceToFreeCashFlowRatioTTM: number
    grossProfitMarginTTM: number; operatingProfitMarginTTM: number; netProfitMarginTTM: number
    currentRatioTTM: number; debtToEquityTTM: number
    dividendYieldTTM: number; epsTTM: number
    revenueGrowthTTM: number; earningsGrowthTTM: number
  }
  type KeyMetrics = {
    returnOnEquity: number; returnOnAssets: number; evToEBITDA: number; currentRatio: number
  }
  type Company = { description: string; sector: string; industry: string; fullTimeEmployees: string; website: string }
  type Analyst = { targetConsensus: number; targetMedian: number }
  type Rec = { analystRatingsStrongBuy: number; analystRatingsBuy: number; analystRatingsHold: number; analystRatingsSell: number; analystRatingsStrongSell: number }[]

  const [profiles, ratiosTTM, keyMetrics, company, analystRaw, consensus] = await Promise.all([
    fmp<Profile[]>("/profile", { symbol: sym }),
    fmp<RatiosTTM[]>("/ratios-ttm", { symbol: sym }).catch(() => []),
    fmp<KeyMetrics[]>("/key-metrics", { symbol: sym, limit: "1" }).catch(() => []),
    fmp<Company[]>("/profile", { symbol: sym }).catch(() => []),
    fmp<Rec>("/analyst-stock-recommendations", { symbol: sym, limit: "1" }).catch(() => []),
    fmp<Analyst[]>("/price-target-consensus", { symbol: sym }).catch(() => []),
  ])

  const p  = profiles?.[0]   ?? {} as Partial<Profile>
  const r  = ratiosTTM?.[0]  ?? {} as Partial<RatiosTTM>
  const km = keyMetrics?.[0] ?? {} as Partial<KeyMetrics>
  const co = company?.[0]    ?? {} as Partial<Company>
  const tgt = consensus?.[0] ?? {} as Partial<Analyst>

  const price     = Number(p.price ?? 0)
  const changePct = Number(p.changePercentage ?? 0)

  // Analyst rating
  let analystRating = ""
  if (analystRaw?.length) {
    const r = analystRaw[0]
    const sb = r.analystRatingsStrongBuy || 0
    const b  = r.analystRatingsBuy || 0
    const h  = r.analystRatingsHold || 0
    const s  = r.analystRatingsSell || 0
    const ss = r.analystRatingsStrongSell || 0
    const total = sb + b + h + s + ss
    const score = total ? (sb*5 + b*4 + h*3 + s*2 + ss*1) / total : 3
    analystRating = score >= 4.2 ? "strong_buy" : score >= 3.5 ? "buy" : score >= 2.5 ? "hold" : "sell"
  }

  return {
    ticker:           sym,
    company_name:     (p as { name?: string }).name ?? sym,
    exchange:         p.exchange ?? "",
    sector:           co.sector ?? "",
    industry:         co.industry ?? "",
    website:          co.website ?? "",
    description:      (co.description ?? "").slice(0, 600),
    employees:        co.fullTimeEmployees ? Number(co.fullTimeEmployees) : null,
    price,
    prev_close:       price - Number(p.change ?? 0),
    change_pct:       changePct,
    market_cap:       n(p.marketCap),
    pe_ratio:         n(r.priceToEarningsRatioTTM),
    forward_pe:       n(r.forwardPriceToEarningsGrowthRatioTTM),
    pb_ratio:         n(r.priceToBookRatioTTM),
    ps_ratio:         n(r.priceToSalesRatioTTM),
    peg_ratio:        n(r.priceToEarningsGrowthRatioTTM),
    ev_ebitda:        n(km.evToEBITDA),
    roe:              n(km.returnOnEquity),
    roa:              n(km.returnOnAssets),
    gross_margin:     n(r.grossProfitMarginTTM),
    operating_margin: n(r.operatingProfitMarginTTM),
    net_margin:       n(r.netProfitMarginTTM),
    debt_to_equity:   n(r.debtToEquityTTM),
    current_ratio:    n(r.currentRatioTTM) ?? n(km.currentRatio),
    revenue_growth:   n(r.revenueGrowthTTM),
    earnings_growth:  n(r.earningsGrowthTTM),
    free_cashflow:    null,
    dividend_yield:   n(r.dividendYieldTTM),
    beta:             n(p.beta),
    "52w_high":       n(p.yearHigh),
    "52w_low":        n(p.yearLow),
    avg_volume:       n(p.averageVolume),
    analyst_rating:   analystRating,
    target_price:     n(tgt.targetConsensus) ?? n(tgt.targetMedian),
    eps:              n(r.epsTTM),
    forward_eps:      null,
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

// ─── Financials ────────────────────────────────────────────────────────────
export async function fetchFinancials(ticker: string): Promise<{ annual: FinancialYear[] }> {
  const sym = ticker.toUpperCase()

  type Inc = { fiscalYear: string; revenue: number; grossProfit: number; operatingIncome: number; netIncome: number; eps: number }
  type Bal = { fiscalYear: string; totalAssets: number; totalLiabilities: number; totalStockholdersEquity: number; totalCurrentAssets: number; totalCurrentLiabilities: number; totalDebt: number }
  type Cf  = { fiscalYear: string; freeCashFlow: number; operatingCashFlow: number; capitalExpenditure: number }

  const [inc, bal, cf] = await Promise.all([
    fmp<Inc[]>("/income-statement", { symbol: sym, limit: "5" }),
    fmp<Bal[]>("/balance-sheet-statement", { symbol: sym, limit: "5" }),
    fmp<Cf[]>("/cash-flow-statement", { symbol: sym, limit: "5" }),
  ])

  const byYear: Record<string, FinancialYear> = {}

  for (const r of inc ?? []) {
    const y = String(r.fiscalYear ?? r.date?.slice(0,4) ?? ""); if (!y) continue
    const rev = n(r.revenue) ?? 0; const ni = n(r.netIncome) ?? 0; const gp = n(r.grossProfit) ?? 0
    byYear[y] = { ...(byYear[y] ?? {}), year: y, revenue: rev, gross_profit: gp, operating_income: n(r.operatingIncome), net_income: ni, eps: n(r.eps), gross_margin: rev ? +(gp/rev).toFixed(4) : null, net_margin: rev ? +(ni/rev).toFixed(4) : null } as FinancialYear
  }
  for (const r of bal ?? []) {
    const y = String(r.fiscalYear ?? r.date?.slice(0,4) ?? ""); if (!y) continue
    const a = n(r.totalAssets) ?? 0; const e = n(r.totalStockholdersEquity) ?? 0; const ni = (byYear[y]?.net_income ?? 0) as number
    byYear[y] = { ...(byYear[y] ?? {}), year: y, total_assets: a, total_liabilities: n(r.totalLiabilities), shareholders_equity: e, current_assets: n(r.totalCurrentAssets), current_liabilities: n(r.totalCurrentLiabilities), total_debt: n(r.totalDebt), roe: e>0?+(ni/e).toFixed(4):null, roa: a>0?+(ni/a).toFixed(4):null, debt_ratio: a?+((n(r.totalLiabilities)??0)/a).toFixed(4):null, current_ratio: n(r.totalCurrentLiabilities)?+((n(r.totalCurrentAssets)??0)/(n(r.totalCurrentLiabilities)??1)).toFixed(2):null } as FinancialYear
  }
  for (const r of cf ?? []) {
    const y = String(r.fiscalYear ?? r.date?.slice(0,4) ?? ""); if (!y) continue
    byYear[y] = { ...(byYear[y] ?? {}), year: y, free_cash_flow: n(r.freeCashFlow), operating_cash_flow: n(r.operatingCashFlow), capex: n(r.capitalExpenditure) } as FinancialYear
  }

  return { annual: Object.values(byYear).sort((a, b) => a.year.localeCompare(b.year)) }
}

// ─── Peers ─────────────────────────────────────────────────────────────────
export async function fetchPeers(ticker: string): Promise<PeerStock[]> {
  const sym = ticker.toUpperCase()
  type PeerRow = { symbol: string; companyName: string; price: number; mktCap: number }
  const list = await fmp<PeerRow[]>("/stock-peers", { symbol: sym }).catch(() => [])
  if (!list?.length) return []

  return list.slice(0, 8).map(p => ({
    ticker: p.symbol, company_name: p.companyName,
    pe_ratio: null, forward_pe: null, pb_ratio: null, ps_ratio: null,
    peg_ratio: null, ev_ebitda: null, net_margin: null, roe: null,
    revenue_growth: null, market_cap: n(p.mktCap),
  }))
}

// ─── Fallback quote ────────────────────────────────────────────────────────
export async function fetchFinnhubQuote(ticker: string) {
  try {
    const data = await fmp<{ price: number; changePercentage: number }[]>("/profile", { symbol: ticker })
    const d = data?.[0]
    return d ? { price: d.price, change_pct: d.changePercentage } : null
  } catch { return null }
}
