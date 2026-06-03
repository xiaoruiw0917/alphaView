// FRED API for macroeconomic data

interface MacroData {
  federal_funds_rate: number | null
  cpi_yoy: number | null
  treasury_10y: number | null
  treasury_2y: number | null
  unemployment: number | null
  gdp_growth: number | null
  summary: string
}

let macroCache: { data: MacroData; ts: number } | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function fetchFREDSeries(seriesId: string, key: string): Promise<number | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=1&sort_order=desc`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json() as { observations?: Array<{ value: string }> }
    const val = data.observations?.[0]?.value
    return val && val !== "." ? parseFloat(val) : null
  } catch {
    return null
  }
}

export async function fetchMacroData(): Promise<MacroData> {
  if (macroCache && Date.now() - macroCache.ts < CACHE_TTL) {
    return macroCache.data
  }

  const key = process.env.FRED_API_KEY
  if (!key) {
    return {
      federal_funds_rate: null, cpi_yoy: null,
      treasury_10y: null, treasury_2y: null,
      unemployment: null, gdp_growth: null,
      summary: "FRED API key not configured."
    }
  }

  const [ffr, cpi, t10y, t2y, unrate, gdp] = await Promise.all([
    fetchFREDSeries("FEDFUNDS", key),
    fetchFREDSeries("CPIAUCSL", key),
    fetchFREDSeries("DGS10", key),
    fetchFREDSeries("DGS2", key),
    fetchFREDSeries("UNRATE", key),
    fetchFREDSeries("A191RL1Q225SBEA", key),
  ])

  const data: MacroData = {
    federal_funds_rate: ffr,
    cpi_yoy: cpi,
    treasury_10y: t10y,
    treasury_2y: t2y,
    unemployment: unrate,
    gdp_growth: gdp,
    summary: buildMacroSummary(ffr, t10y, t2y, unrate),
  }

  macroCache = { data, ts: Date.now() }
  return data
}

function buildMacroSummary(ffr: number | null, t10y: number | null, t2y: number | null, unrate: number | null): string {
  const parts: string[] = []
  if (ffr !== null) parts.push(`Fed Funds Rate: ${ffr.toFixed(2)}%`)
  if (t10y !== null) parts.push(`10Y Treasury: ${t10y.toFixed(2)}%`)
  if (t2y !== null) {
    parts.push(`2Y Treasury: ${t2y.toFixed(2)}%`)
    if (t10y !== null) {
      const spread = t10y - t2y
      parts.push(`Yield Curve: ${spread >= 0 ? "Normal" : "Inverted"} (${spread.toFixed(2)}%)`)
    }
  }
  if (unrate !== null) parts.push(`Unemployment: ${unrate.toFixed(1)}%`)
  return parts.join(" | ")
}
