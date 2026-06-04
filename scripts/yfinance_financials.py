#!/usr/bin/env python3
"""
yfinance bridge — financial statements + peers
Usage: python3 scripts/yfinance_financials.py <TICKER> [FMP_API_KEY]
Output: JSON { annual: FinancialYear[], peers: PeerStock[] }
"""
import sys
import json
import math
import requests

import yfinance as yf


def safe(df, row):
    """Get a value from a DataFrame row, return None if missing/NaN/zero."""
    try:
        v = float(df.loc[row].iloc[0])
        return None if (math.isnan(v) or math.isinf(v)) else v
    except Exception:
        return None


def safe_val(v):
    try:
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f) or f == 0) else f
    except Exception:
        return None


def build_annual(ticker: str) -> list:
    t = yf.Ticker(ticker)
    inc = t.financials       # cols = dates desc, rows = metrics
    bal = t.balance_sheet
    cf  = t.cashflow

    results = []
    cols = list(inc.columns)  # e.g. ['2025-10-31', '2024-10-31', ...]

    for col in cols:
        year = str(col)[:4]

        def gi(row):   # get from income
            try: v = float(inc.loc[row, col]); return None if math.isnan(v) or math.isinf(v) else v
            except: return None

        def gb(row):   # get from balance
            try: v = float(bal.loc[row, col]); return None if math.isnan(v) or math.isinf(v) else v
            except: return None

        def gc(row):   # get from cashflow
            try: v = float(cf.loc[row, col]); return None if math.isnan(v) or math.isinf(v) else v
            except: return None

        rev  = gi("Total Revenue")
        gp   = gi("Gross Profit")
        op   = gi("Operating Income")
        ni   = gi("Net Income")
        eps  = gi("Diluted EPS")

        ta   = gb("Total Assets")
        tl   = gb("Total Liabilities Net Minority Interest")
        eq   = gb("Common Stock Equity") or gb("Stockholders Equity")
        ca   = gb("Current Assets")
        cl   = gb("Current Liabilities")
        debt = gb("Total Debt")

        fcf  = gc("Free Cash Flow")
        ocf  = gc("Operating Cash Flow")
        cap  = gc("Capital Expenditure")

        results.append({
            "year":               year,
            "revenue":            rev,
            "gross_profit":       gp,
            "operating_income":   op,
            "net_income":         ni,
            "eps":                eps,
            "free_cash_flow":     fcf,
            "operating_cash_flow": ocf,
            "capex":              cap,
            "total_assets":       ta,
            "total_liabilities":  tl,
            "shareholders_equity": eq,
            "total_debt":         debt,
            "gross_margin":       round(gp / rev, 4) if rev and gp else None,
            "net_margin":         round(ni / rev, 4) if rev and ni else None,
            "roe":                round(ni / eq,  4) if eq  and ni else None,
            "roa":                round(ni / ta,  4) if ta  and ni else None,
            "debt_ratio":         round(tl / ta,  4) if ta  and tl else None,
            "current_ratio":      round(ca / cl,  2) if ca  and cl else None,
        })

    # drop years where all financial fields are None
    results = [r for r in results if r.get("revenue") is not None or r.get("total_assets") is not None]
    return sorted(results, key=lambda r: r["year"])


def fetch_peers_fmp(ticker: str, api_key: str) -> list:
    """Get peer tickers from FMP (free endpoint)."""
    url = f"https://financialmodelingprep.com/stable/stock-peers?symbol={ticker}&apikey={api_key}"
    try:
        data = requests.get(url, timeout=10).json()
        return [{"symbol": d["symbol"], "name": d.get("companyName", d["symbol"])}
                for d in (data or [])[:8]]
    except Exception:
        return []


def fetch_peer_info(symbol: str) -> dict:
    """Get key ratios for a single peer via yfinance."""
    try:
        info = yf.Ticker(symbol).info or {}
        return {
            "ticker":         symbol,
            "company_name":   info.get("shortName") or info.get("longName") or symbol,
            "pe_ratio":       safe_val(info.get("trailingPE")),
            "forward_pe":     safe_val(info.get("forwardPE")),
            "pb_ratio":       safe_val(info.get("priceToBook")),
            "ps_ratio":       safe_val(info.get("priceToSalesTrailing12Months")),
            "peg_ratio":      safe_val(info.get("pegRatio")),
            "ev_ebitda":      safe_val(info.get("enterpriseToEbitda")),
            "net_margin":     safe_val(info.get("profitMargins")),
            "roe":            safe_val(info.get("returnOnEquity")),
            "revenue_growth": safe_val(info.get("revenueGrowth")),
            "market_cap":     safe_val(info.get("marketCap")),
        }
    except Exception:
        return {"ticker": symbol, "company_name": symbol,
                "pe_ratio": None, "forward_pe": None, "pb_ratio": None,
                "ps_ratio": None, "peg_ratio": None, "ev_ebitda": None,
                "net_margin": None, "roe": None, "revenue_growth": None, "market_cap": None}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "ticker required"}))
        sys.exit(1)

    ticker  = sys.argv[1].upper()
    api_key = sys.argv[2] if len(sys.argv) > 2 else ""

    try:
        annual = build_annual(ticker)
    except Exception:
        annual = []

    peers = []
    if api_key:
        peer_list = fetch_peers_fmp(ticker, api_key)
        for p in peer_list:
            peers.append(fetch_peer_info(p["symbol"]))

    print(json.dumps({"annual": annual, "peers": peers}))


if __name__ == "__main__":
    main()
