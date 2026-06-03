import { spawn } from "child_process"
import path from "path"
import type { StockOverview, OHLCVBar, FinancialYear, PeerStock } from "@/lib/types/stock"

const PYTHON = process.env.PYTHON_PATH || "python3"
const SCRIPT = path.join(process.cwd(), "scripts", "fetch_stock.py")

function runPython(args: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [SCRIPT, ...args])
    let out = ""
    let err = ""
    proc.stdout.on("data", (d) => (out += d))
    proc.stderr.on("data", (d) => (err += d))
    proc.on("close", (code) => {
      if (code !== 0 && !out) {
        reject(new Error(err || `Python exited with code ${code}`))
        return
      }
      try {
        resolve(JSON.parse(out))
      } catch {
        reject(new Error(`Invalid JSON from Python: ${out.slice(0, 200)}`))
      }
    })
    proc.on("error", reject)
    // Timeout after 30s
    setTimeout(() => { proc.kill(); reject(new Error("Python timeout")) }, 30000)
  })
}

export async function fetchOverview(ticker: string): Promise<StockOverview> {
  const data = await runPython(["--ticker", ticker.toUpperCase(), "--mode", "overview"])
  if ((data as { error?: string }).error) {
    throw new Error((data as { error: string }).error)
  }
  return data as StockOverview
}

export async function fetchHistory(ticker: string, period = "1y"): Promise<OHLCVBar[]> {
  const data = await runPython(["--ticker", ticker.toUpperCase(), "--mode", "history", "--period", period])
  return data as OHLCVBar[]
}

export async function fetchFinancials(ticker: string): Promise<{ annual: FinancialYear[] }> {
  const data = await runPython(["--ticker", ticker.toUpperCase(), "--mode", "financials"])
  return data as { annual: FinancialYear[] }
}

export async function fetchPeers(ticker: string): Promise<PeerStock[]> {
  const data = await runPython(["--ticker", ticker.toUpperCase(), "--mode", "peers"])
  return data as PeerStock[]
}

// Fallback: Finnhub quote
export async function fetchFinnhubQuote(ticker: string) {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    const d = await res.json()
    return { price: d.c, change_pct: d.dp, high: d.h, low: d.l, volume: d.v }
  } catch {
    return null
  }
}
