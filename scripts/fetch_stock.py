#!/usr/bin/env python3
"""
yfinance data bridge for Next.js API routes.
Usage: python3 fetch_stock.py --ticker NVDA --mode overview|history|peers|financials
Outputs JSON to stdout.
"""
import sys
import json
import argparse
import warnings
warnings.filterwarnings("ignore")

try:
    import yfinance as yf
    import pandas as pd
except ImportError as e:
    print(json.dumps({"error": f"Missing package: {e}. Run: pip3 install yfinance pandas"}))
    sys.exit(1)


def safe_val(v, default=None):
    if v is None or (isinstance(v, float) and (v != v)):  # NaN check
        return default
    if isinstance(v, (pd.Timestamp,)):
        return str(v)
    try:
        if isinstance(v, float) and abs(v) > 1e15:
            return None
        return float(v) if isinstance(v, float) else v
    except Exception:
        return default


def get_overview(ticker: str) -> dict:
    tk = yf.Ticker(ticker)
    info = tk.info or {}

    price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
    prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose") or price
    change = ((price - prev_close) / prev_close * 100) if price and prev_close and prev_close != 0 else 0

    return {
        "ticker": ticker.upper(),
        "company_name": info.get("longName") or info.get("shortName", ticker.upper()),
        "exchange": info.get("exchange", ""),
        "sector": info.get("sector", ""),
        "industry": info.get("industry", ""),
        "website": info.get("website", ""),
        "description": (info.get("longBusinessSummary") or "")[:500],
        "employees": info.get("fullTimeEmployees"),
        "price": safe_val(price),
        "prev_close": safe_val(prev_close),
        "change_pct": round(change, 2),
        "market_cap": safe_val(info.get("marketCap")),
        "pe_ratio": safe_val(info.get("trailingPE")),
        "forward_pe": safe_val(info.get("forwardPE")),
        "pb_ratio": safe_val(info.get("priceToBook")),
        "ps_ratio": safe_val(info.get("priceToSalesTrailing12Months")),
        "peg_ratio": safe_val(info.get("pegRatio")),
        "ev_ebitda": safe_val(info.get("enterpriseToEbitda")),
        "roe": safe_val(info.get("returnOnEquity")),
        "roa": safe_val(info.get("returnOnAssets")),
        "gross_margin": safe_val(info.get("grossMargins")),
        "operating_margin": safe_val(info.get("operatingMargins")),
        "net_margin": safe_val(info.get("profitMargins")),
        "debt_to_equity": safe_val(info.get("debtToEquity")),
        "current_ratio": safe_val(info.get("currentRatio")),
        "revenue_growth": safe_val(info.get("revenueGrowth")),
        "earnings_growth": safe_val(info.get("earningsGrowth")),
        "free_cashflow": safe_val(info.get("freeCashflow")),
        "dividend_yield": safe_val(info.get("dividendYield")),
        "beta": safe_val(info.get("beta")),
        "52w_high": safe_val(info.get("fiftyTwoWeekHigh")),
        "52w_low": safe_val(info.get("fiftyTwoWeekLow")),
        "avg_volume": safe_val(info.get("averageVolume")),
        "analyst_rating": info.get("recommendationKey", ""),
        "target_price": safe_val(info.get("targetMeanPrice")),
        "eps": safe_val(info.get("trailingEps")),
        "forward_eps": safe_val(info.get("forwardEps")),
    }


def get_history(ticker: str, period: str = "1y") -> list:
    tk = yf.Ticker(ticker)
    hist = tk.history(period=period, interval="1d")
    if hist.empty:
        return []
    result = []
    for ts, row in hist.iterrows():
        result.append({
            "time": ts.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        })
    return result


def get_financials(ticker: str) -> dict:
    tk = yf.Ticker(ticker)

    def df_to_list(df, key_map):
        if df is None or df.empty:
            return []
        rows = []
        for col in df.columns:
            row = {"year": str(col)[:4]}
            for src_key, dst_key in key_map.items():
                v = df.loc[src_key, col] if src_key in df.index else None
                row[dst_key] = safe_val(v)
            rows.append(row)
        return rows[::-1]  # oldest first

    income_map = {
        "Total Revenue": "revenue",
        "Gross Profit": "gross_profit",
        "Operating Income": "operating_income",
        "Net Income": "net_income",
        "Diluted EPS": "eps",
    }
    balance_map = {
        "Total Assets": "total_assets",
        "Total Liabilities Net Minority Interest": "total_liabilities",
        "Stockholders Equity": "shareholders_equity",
        "Current Assets": "current_assets",
        "Current Liabilities": "current_liabilities",
        "Total Debt": "total_debt",
    }
    cashflow_map = {
        "Free Cash Flow": "free_cash_flow",
        "Operating Cash Flow": "operating_cash_flow",
        "Capital Expenditure": "capex",
    }

    income = df_to_list(tk.financials, income_map)
    balance = df_to_list(tk.balance_sheet, balance_map)
    cashflow = df_to_list(tk.cashflow, cashflow_map)

    # Merge into unified annual records
    years = {}
    for r in income:
        years.setdefault(r["year"], {}).update(r)
    for r in balance:
        years.setdefault(r["year"], {}).update(r)
    for r in cashflow:
        years.setdefault(r["year"], {}).update(r)

    # Compute derived ratios
    for y, r in years.items():
        rev = r.get("revenue") or 0
        ni = r.get("net_income") or 0
        gp = r.get("gross_profit") or 0
        assets = r.get("total_assets") or 0
        equity = r.get("shareholders_equity") or 0
        liab = r.get("total_liabilities") or 0
        cur_a = r.get("current_assets") or 0
        cur_l = r.get("current_liabilities") or 1
        r["net_margin"] = round(ni / rev, 4) if rev else None
        r["gross_margin"] = round(gp / rev, 4) if rev else None
        r["roe"] = round(ni / equity, 4) if equity and equity > 0 else None
        r["roa"] = round(ni / assets, 4) if assets and assets > 0 else None
        r["debt_ratio"] = round(liab / assets, 4) if assets else None
        r["current_ratio"] = round(cur_a / cur_l, 2) if cur_l else None

    return {"annual": sorted(years.values(), key=lambda x: x["year"])}


def get_peers(ticker: str) -> list:
    """Use FMP-style sector peers from yfinance info."""
    tk = yf.Ticker(ticker)
    info = tk.info or {}
    sector = info.get("sector", "")
    industry = info.get("industry", "")

    # Hardcoded peer maps based on common sectors
    peer_map = {
        "NVDA": ["AMD", "INTC", "QCOM", "AVGO", "TSM", "AMAT", "KLAC", "LRCX"],
        "AMD": ["NVDA", "INTC", "QCOM", "AVGO", "MU", "AMAT"],
        "AAPL": ["MSFT", "GOOGL", "META", "AMZN", "TSLA", "SAMSUNG"],
        "MSFT": ["GOOGL", "AMZN", "AAPL", "META", "CRM", "ORCL"],
        "TSLA": ["RIVN", "LCID", "F", "GM", "BYDDF", "NIO", "LI"],
        "META": ["GOOGL", "SNAP", "PINS", "TWTR", "MSFT", "AMZN"],
        "GOOGL": ["META", "MSFT", "AMZN", "AAPL", "SNAP"],
        "AMZN": ["MSFT", "GOOGL", "BABA", "JD", "WMT", "SHOP"],
        "INTC": ["NVDA", "AMD", "QCOM", "AVGO", "TSM", "MU"],
        "QCOM": ["NVDA", "AMD", "INTC", "AVGO", "MRVL"],
    }

    peers = peer_map.get(ticker.upper(), [])
    if not peers:
        # fallback: return empty list
        return []

    results = []
    for p in peers[:8]:
        try:
            pt = yf.Ticker(p)
            pi = pt.info or {}
            results.append({
                "ticker": p,
                "company_name": pi.get("longName") or pi.get("shortName", p),
                "pe_ratio": safe_val(pi.get("trailingPE")),
                "forward_pe": safe_val(pi.get("forwardPE")),
                "pb_ratio": safe_val(pi.get("priceToBook")),
                "ps_ratio": safe_val(pi.get("priceToSalesTrailing12Months")),
                "peg_ratio": safe_val(pi.get("pegRatio")),
                "ev_ebitda": safe_val(pi.get("enterpriseToEbitda")),
                "net_margin": safe_val(pi.get("profitMargins")),
                "roe": safe_val(pi.get("returnOnEquity")),
                "revenue_growth": safe_val(pi.get("revenueGrowth")),
                "market_cap": safe_val(pi.get("marketCap")),
            })
        except Exception:
            pass
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", required=True)
    parser.add_argument("--mode", default="overview",
                        choices=["overview", "history", "financials", "peers"])
    parser.add_argument("--period", default="1y")
    args = parser.parse_args()

    try:
        if args.mode == "overview":
            data = get_overview(args.ticker)
        elif args.mode == "history":
            data = get_history(args.ticker, args.period)
        elif args.mode == "financials":
            data = get_financials(args.ticker)
        elif args.mode == "peers":
            data = get_peers(args.ticker)
        else:
            data = {"error": "unknown mode"}
        print(json.dumps(data, default=str))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
