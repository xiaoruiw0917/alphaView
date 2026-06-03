export interface StockOverview {
  ticker: string
  company_name: string
  exchange: string
  sector: string
  industry: string
  website: string
  description: string
  employees: number | null
  price: number | null
  prev_close: number | null
  change_pct: number
  market_cap: number | null
  pe_ratio: number | null
  forward_pe: number | null
  pb_ratio: number | null
  ps_ratio: number | null
  peg_ratio: number | null
  ev_ebitda: number | null
  roe: number | null
  roa: number | null
  gross_margin: number | null
  operating_margin: number | null
  net_margin: number | null
  debt_to_equity: number | null
  current_ratio: number | null
  revenue_growth: number | null
  earnings_growth: number | null
  free_cashflow: number | null
  dividend_yield: number | null
  beta: number | null
  "52w_high": number | null
  "52w_low": number | null
  avg_volume: number | null
  analyst_rating: string
  target_price: number | null
  eps: number | null
  forward_eps: number | null
}

export interface OHLCVBar {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface FinancialYear {
  year: string
  revenue: number | null
  gross_profit: number | null
  operating_income: number | null
  net_income: number | null
  eps: number | null
  free_cash_flow: number | null
  operating_cash_flow: number | null
  capex: number | null
  total_assets: number | null
  total_liabilities: number | null
  shareholders_equity: number | null
  total_debt: number | null
  net_margin: number | null
  gross_margin: number | null
  roe: number | null
  roa: number | null
  debt_ratio: number | null
  current_ratio: number | null
}

export interface PeerStock {
  ticker: string
  company_name: string
  pe_ratio: number | null
  forward_pe: number | null
  pb_ratio: number | null
  ps_ratio: number | null
  peg_ratio: number | null
  ev_ebitda: number | null
  net_margin: number | null
  roe: number | null
  revenue_growth: number | null
  market_cap: number | null
}

export interface TechnicalIndicators {
  ma20: number | null
  ma50: number | null
  ma200: number | null
  rsi: number | null
  macd: number | null
  macd_signal: number | null
  macd_hist: number | null
  volume_ratio: number | null
  support: number | null
  resistance: number | null
  price_vs_ma200_pct: number | null
}

// Agent output types
export interface FinancialValuationResult {
  financial_health: "Strong" | "Moderate" | "Weak" | "Deteriorating"
  moat_assessment: string
  cash_flow_quality: "Excellent" | "Good" | "Fair" | "Poor"
  leverage_risk: "Low" | "Medium" | "High"
  valuation_status: "Undervalued" | "Fair" | "Expensive" | "Extremely Expensive"
  peer_rank: "1st Quartile" | "2nd Quartile" | "3rd Quartile" | "4th Quartile"
  upside_risk: "Low" | "Medium" | "High"
  buffett_score: number
  conclusion: string
  summary: string
}

export interface SupplyChainItem {
  ticker: string
  company: string
  role: string
}

export interface Competitor {
  ticker: string
  company: string
  threat_level: "Low" | "Medium" | "High"
}

export interface IndustrySupplyChainResult {
  upstream: SupplyChainItem[]
  midstream: SupplyChainItem[]
  downstream: SupplyChainItem[]
  competitors: Competitor[]
  bargaining_power: "Strong" | "Moderate" | "Weak"
  supply_chain_position: string
  industry_outlook: string
  market_size_usd_bn: number | null
  cagr_5yr_pct: number | null
  cycle_stage: "Early" | "Growth" | "Peak" | "Declining"
  key_risks: string[]
  most_benefited_segment: string
  margin_squeeze_segment: string
  summary: string
}

export interface TechnicalRiskResult {
  trend: "Uptrend" | "Sideways" | "Downtrend" | "Breakout Watch" | "Breakdown Risk"
  ma20: number | null
  ma50: number | null
  ma200: number | null
  price_vs_ma200_pct: number | null
  rsi: number | null
  rsi_signal: "Overbought" | "Neutral" | "Oversold"
  macd_signal: "Bullish" | "Neutral" | "Bearish"
  volume_alert: boolean
  volume_ratio: number | null
  support_level: number | null
  resistance_level: number | null
  technical_conclusion: string
  risk_flags: string[]
  overall_risk: "Low" | "Medium" | "High" | "Speculative"
  risk_summary: string
}

export interface HotStock {
  theme: string
  theme_heat: number
  ticker: string
  company_name: string
  exchange: string
  supply_chain_position: string
  benefit_logic: string
  hot_score: number
  score_breakdown: {
    news_heat: number
    credibility: number
    policy: number
    growth: number
    financial: number
    valuation: number
    technical: number
  }
  risk_level: "Low" | "Medium" | "High" | "Speculative"
  key_news: string[]
  conclusion: string
}

export interface FullReport {
  ticker: string
  investment_summary: string
  business_overview: string
  financial_health_section: string
  valuation_section: string
  supply_chain_section: string
  industry_trend_section: string
  policy_section: string
  technical_section: string
  key_risks: string[]
  long_term_score: number
  conclusion: string
  disclaimer: string
  generated_at: string
}

export type TaskType =
  | "stock_basic"
  | "financial_analysis"
  | "industry_research"
  | "technical_alert"
  | "hot_stocks"
  | "full_report"
