import type { OHLCVBar, TechnicalIndicators } from "@/lib/types/stock"

function sma(closes: number[], period: number): number[] {
  return closes.map((_, i) => {
    if (i < period - 1) return NaN
    const slice = closes.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

function ema(closes: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(NaN); continue }
    if (i === period - 1) { result.push(prev); continue }
    prev = closes[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

function rsi(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period + 1) return result

  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff
    else losses += -diff
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  for (let i = period; i < closes.length; i++) {
    if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result[i] = 100 - 100 / (1 + rs)
      continue
    }
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result[i] = 100 - 100 / (1 + rs)
  }
  return result
}

function macd(closes: number[]) {
  const fast = ema(closes, 12)
  const slow = ema(closes, 26)
  const macdLine = fast.map((f, i) => (isNaN(f) || isNaN(slow[i])) ? NaN : f - slow[i])
  const validMacd = macdLine.filter(v => !isNaN(v))
  const signal = ema(validMacd, 9)
  const fullSignal = macdLine.map((v, i) => {
    if (isNaN(v)) return NaN
    const validIdx = macdLine.slice(0, i + 1).filter(x => !isNaN(x)).length - 1
    return signal[validIdx] ?? NaN
  })
  return { macdLine, signalLine: fullSignal }
}

export function computeTechnicals(bars: OHLCVBar[]): TechnicalIndicators & { bars_with_indicators: (OHLCVBar & { ma20?: number; ma50?: number; ma200?: number; rsi?: number })[] } {
  if (!bars || bars.length === 0) {
    return {
      ma20: null, ma50: null, ma200: null, rsi: null,
      macd: null, macd_signal: null, macd_hist: null,
      volume_ratio: null, support: null, resistance: null,
      price_vs_ma200_pct: null, bars_with_indicators: []
    }
  }

  const closes = bars.map(b => b.close)
  const volumes = bars.map(b => b.volume)

  const ma20Arr = sma(closes, 20)
  const ma50Arr = sma(closes, 50)
  const ma200Arr = sma(closes, 200)
  const rsiArr = rsi(closes, 14)
  const { macdLine, signalLine } = macd(closes)

  const last = closes.length - 1
  const ma20 = isNaN(ma20Arr[last]) ? null : Number(ma20Arr[last].toFixed(2))
  const ma50 = isNaN(ma50Arr[last]) ? null : Number(ma50Arr[last].toFixed(2))
  const ma200 = isNaN(ma200Arr[last]) ? null : Number(ma200Arr[last].toFixed(2))
  const rsiVal = isNaN(rsiArr[last]) ? null : Number(rsiArr[last].toFixed(2))
  const macdVal = isNaN(macdLine[last]) ? null : Number(macdLine[last].toFixed(4))
  const macdSig = isNaN(signalLine[last]) ? null : Number(signalLine[last].toFixed(4))
  const macdHist = macdVal !== null && macdSig !== null ? Number((macdVal - macdSig).toFixed(4)) : null

  // Volume: compare last volume to 20-day avg
  const recentVolumes = volumes.slice(-20)
  const avgVol = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length
  const volumeRatio = avgVol > 0 ? Number((volumes[last] / avgVol).toFixed(2)) : null

  // Support/resistance: 52-week low/high
  const recent52 = bars.slice(-252)
  const support = Number(Math.min(...recent52.map(b => b.low)).toFixed(2))
  const resistance = Number(Math.max(...recent52.map(b => b.high)).toFixed(2))

  const currentPrice = closes[last]
  const price_vs_ma200_pct = ma200 ? Number(((currentPrice - ma200) / ma200 * 100).toFixed(2)) : null

  // Bars with indicators attached
  const bars_with_indicators = bars.map((b, i) => ({
    ...b,
    ma20: isNaN(ma20Arr[i]) ? undefined : Number(ma20Arr[i].toFixed(2)),
    ma50: isNaN(ma50Arr[i]) ? undefined : Number(ma50Arr[i].toFixed(2)),
    ma200: isNaN(ma200Arr[i]) ? undefined : Number(ma200Arr[i].toFixed(2)),
    rsi: isNaN(rsiArr[i]) ? undefined : Number(rsiArr[i].toFixed(2)),
  }))

  return {
    ma20, ma50, ma200, rsi: rsiVal,
    macd: macdVal, macd_signal: macdSig, macd_hist: macdHist,
    volume_ratio: volumeRatio, support, resistance,
    price_vs_ma200_pct, bars_with_indicators
  }
}
