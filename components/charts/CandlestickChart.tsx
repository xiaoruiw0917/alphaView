"use client"
import { useEffect, useRef, useState } from "react"
import type { OHLCVBar } from "@/lib/types/stock"

interface ChartBar extends OHLCVBar {
  ma20?: number
  ma50?: number
  ma200?: number
  rsi?: number
}

interface Props {
  bars: ChartBar[]
  ticker: string
}

export default function CandlestickChart({ bars, ticker }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [period, setPeriod] = useState<"3m" | "6m" | "1y" | "2y">("1y")

  useEffect(() => {
    if (!chartRef.current || bars.length === 0) return

    let cleanup: (() => void) | null = null

    // v5 API: import series types + createChart
    import("lightweight-charts").then((lc) => {
      if (!chartRef.current) return

      const { createChart, CandlestickSeries, LineSeries, HistogramSeries, CrosshairMode } = lc as {
        createChart: typeof import("lightweight-charts").createChart
        CandlestickSeries: import("lightweight-charts").SeriesDefinition<"Candlestick">
        LineSeries: import("lightweight-charts").SeriesDefinition<"Line">
        HistogramSeries: import("lightweight-charts").SeriesDefinition<"Histogram">
        CrosshairMode: typeof import("lightweight-charts").CrosshairMode
      }

      // Filter by period
      const cutoffs: Record<string, number> = { "3m": 90, "6m": 180, "1y": 365, "2y": 730 }
      const cutoff = new Date(Date.now() - cutoffs[period] * 86400000)
      const filtered = bars.filter(b => new Date(b.time) >= cutoff)

      chartRef.current.innerHTML = ""

      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 400,
        layout: { background: { color: "#111827" }, textColor: "#9ca3af" },
        grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#1f2937" },
        timeScale: { borderColor: "#1f2937", timeVisible: true },
      })

      // Candlestick series
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#ef4444",
        borderUpColor: "#10b981",
        borderDownColor: "#ef4444",
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      })
      candleSeries.setData(filtered.map(b => ({
        time: b.time as `${number}-${number}-${number}`,
        open: b.open, high: b.high, low: b.low, close: b.close,
      })))

      // Volume series (overlay on same pane, small scale)
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "#3b82f6",
        priceFormat: { type: "volume" as const },
        priceScaleId: "volume",
      })
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        borderVisible: false,
      })
      volumeSeries.setData(filtered.map(b => ({
        time: b.time as `${number}-${number}-${number}`,
        value: b.volume,
        color: b.close >= b.open ? "#10b98130" : "#ef444430",
      })))

      // MA lines
      const maConfigs = [
        { key: "ma20" as const, color: "#f59e0b", title: "MA20" },
        { key: "ma50" as const, color: "#8b5cf6", title: "MA50" },
        { key: "ma200" as const, color: "#ef4444", title: "MA200" },
      ]
      for (const cfg of maConfigs) {
        const maData = filtered
          .filter(b => b[cfg.key] !== undefined)
          .map(b => ({ time: b.time as `${number}-${number}-${number}`, value: b[cfg.key]! }))
        if (maData.length > 0) {
          const maSeries = chart.addSeries(LineSeries, {
            color: cfg.color,
            lineWidth: 1,
            title: cfg.title,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          })
          maSeries.setData(maData)
        }
      }

      chart.timeScale().fitContent()

      const handleResize = () => {
        if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth })
      }
      window.addEventListener("resize", handleResize)
      cleanup = () => { window.removeEventListener("resize", handleResize); chart.remove() }
    })

    return () => { cleanup?.() }
  }, [bars, period])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{ticker} — Price & Volume</h3>
        <div className="flex gap-1">
          {(["3m", "6m", "1y", "2y"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                period === p ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartRef} className="w-full rounded-lg overflow-hidden" />
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block" />MA20</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block" />MA50</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" />MA200</span>
      </div>
    </div>
  )
}
