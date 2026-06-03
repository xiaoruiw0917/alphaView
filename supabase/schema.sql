-- Run this in Supabase SQL Editor to initialize the database

CREATE TABLE IF NOT EXISTS stocks (
  ticker TEXT PRIMARY KEY,
  company_name TEXT,
  exchange TEXT,
  sector TEXT,
  industry TEXT,
  market_cap BIGINT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT REFERENCES stocks(ticker) ON DELETE CASCADE,
  year INT,
  revenue BIGINT,
  gross_profit BIGINT,
  operating_income BIGINT,
  net_income BIGINT,
  eps NUMERIC,
  free_cash_flow BIGINT,
  total_assets BIGINT,
  total_liabilities BIGINT,
  shareholders_equity BIGINT,
  roe NUMERIC,
  roa NUMERIC,
  net_margin NUMERIC,
  debt_ratio NUMERIC,
  current_ratio NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, year)
);

CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  source TEXT,
  published_at TIMESTAMPTZ,
  summary TEXT,
  tickers_mentioned TEXT[],
  themes TEXT[],
  sentiment TEXT,
  source_score NUMERIC,
  market_impact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hot_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  ticker TEXT,
  company_name TEXT,
  theme TEXT,
  hot_score NUMERIC,
  benefit_logic TEXT,
  risk_level TEXT,
  news_evidence TEXT,
  conclusion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT,
  mode TEXT DEFAULT 'full',
  report_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT,
  alert_type TEXT,
  message TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_financials_ticker ON financials(ticker);
CREATE INDEX IF NOT EXISTS idx_hot_stocks_date ON hot_stocks(date);
CREATE INDEX IF NOT EXISTS idx_reports_ticker ON reports(ticker);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at DESC);
