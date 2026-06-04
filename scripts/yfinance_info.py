#!/usr/bin/env python3
"""
yfinance bridge — called by Next.js via child_process.spawn
Usage: python3 scripts/yfinance_info.py <TICKER>
Output: JSON to stdout
"""
import sys
import json
import yfinance as yf

def safe(val):
    if val is None or val != val:  # None or NaN
        return None
    try:
        f = float(val)
        return None if (f == 0 or not (f == f)) else f
    except (TypeError, ValueError):
        return None

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "ticker required"}))
        sys.exit(1)

    ticker = sys.argv[1].upper()
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        result = {
            "pe_ratio":         safe(info.get("trailingPE")),
            "forward_pe":       safe(info.get("forwardPE")),
            "pb_ratio":         safe(info.get("priceToBook")),
            "ps_ratio":         safe(info.get("priceToSalesTrailing12Months")),
            "peg_ratio":        safe(info.get("pegRatio")),
            "ev_ebitda":        safe(info.get("enterpriseToEbitda")),
            "roe":              safe(info.get("returnOnEquity")),
            "roa":              safe(info.get("returnOnAssets")),
            "gross_margin":     safe(info.get("grossMargins")),
            "operating_margin": safe(info.get("operatingMargins")),
            "net_margin":       safe(info.get("profitMargins")),
            "debt_to_equity":   safe(info.get("debtToEquity")),
            "current_ratio":    safe(info.get("currentRatio")),
            "revenue_growth":   safe(info.get("revenueGrowth")),
            "earnings_growth":  safe(info.get("earningsGrowth")),
            "free_cashflow":    safe(info.get("freeCashflow")),
            "dividend_yield":   safe(info.get("dividendYield")),
            "target_price":     safe(info.get("targetMeanPrice")),
            "eps":              safe(info.get("trailingEps")),
            "forward_eps":      safe(info.get("forwardEps")),
            "52w_high":         safe(info.get("fiftyTwoWeekHigh")),
            "52w_low":          safe(info.get("fiftyTwoWeekLow")),
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
