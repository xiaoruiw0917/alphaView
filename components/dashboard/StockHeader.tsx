import type { StockOverview } from "@/lib/types/stock"
import { Badge } from "@/components/ui/Badge"

function fmt(v: number | null, prefix = "", suffix = "", dec = 2) {
  if (v === null || v === undefined) return "—"
  return `${prefix}${v.toFixed(dec)}${suffix}`
}

function fmtMktCap(v: number | null) {
  if (!v) return "—"
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

export function StockHeader({ data }: { data: StockOverview }) {
  const isUp = data.change_pct >= 0
  const analystBadge = data.analyst_rating?.replace("_", " ").toUpperCase()

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Left: company info */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold font-mono text-blue-400">{data.ticker}</span>
            {data.exchange && (
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{data.exchange}</span>
            )}
            {analystBadge && (
              <Badge
                label={analystBadge}
                variant={analystBadge.includes("BUY") ? "green" : analystBadge.includes("SELL") ? "red" : "yellow"}
              />
            )}
          </div>
          <h1 className="text-lg font-semibold text-white">{data.company_name}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{data.sector} · {data.industry}</p>
        </div>

        {/* Right: price */}
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">
            {data.price !== null ? `$${data.price.toFixed(2)}` : "—"}
          </div>
          <div className={`text-base font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
            {isUp ? "▲" : "▼"} {Math.abs(data.change_pct).toFixed(2)}%
          </div>
          <div className="text-sm text-[var(--text-muted)] mt-1">
            市值：{fmtMktCap(data.market_cap)}
          </div>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3 mt-4 pt-4 border-t border-[var(--border)]">
        {[
          ["市盈率", fmt(data.pe_ratio, "", "x", 1)],
          ["预期PE", fmt(data.forward_pe, "", "x", 1)],
          ["市净率", fmt(data.pb_ratio, "", "x", 2)],
          ["PEG", fmt(data.peg_ratio, "", "", 2)],
          ["ROE", fmt(data.roe ? data.roe * 100 : null, "", "%", 1)],
          ["ROA", fmt(data.roa ? data.roa * 100 : null, "", "%", 1)],
          ["净利率", fmt(data.net_margin ? data.net_margin * 100 : null, "", "%", 1)],
          ["Beta", fmt(data.beta, "", "", 2)],
        ].map(([label, value]) => (
          <div key={label} className="text-center">
            <div className="text-xs text-[var(--text-muted)] mb-0.5">{label}</div>
            <div className="text-sm font-semibold tabular-nums text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* 52w range */}
      {data["52w_high"] && data["52w_low"] && data.price && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
            <span>52周低：${data["52w_low"].toFixed(2)}</span>
            <span>52周高：${data["52w_high"].toFixed(2)}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, ((data.price - data["52w_low"]) / (data["52w_high"] - data["52w_low"])) * 100))}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
