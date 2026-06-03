import type { PeerStock, StockOverview } from "@/lib/types/stock"
import clsx from "clsx"

function Cell({ v, better }: { v: number | null; better?: boolean }) {
  if (v === null || v === undefined) return <span className="text-gray-600">—</span>
  return <span className={clsx("tabular-nums", better === true ? "text-emerald-400 font-semibold" : better === false ? "text-red-400" : "text-white")}>
    {v.toFixed(1)}
  </span>
}

function pctCell(v: number | null) {
  if (v === null || v === undefined) return <span className="text-gray-600">—</span>
  return <span className={(v ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}>{(v * 100).toFixed(1)}%</span>
}

export function PeerComparison({ target, peers }: { target: StockOverview; peers: PeerStock[] }) {
  const allStocks = [
    {
      ticker: target.ticker,
      company_name: target.company_name,
      pe_ratio: target.pe_ratio,
      forward_pe: target.forward_pe,
      pb_ratio: target.pb_ratio,
      ps_ratio: target.ps_ratio,
      peg_ratio: target.peg_ratio,
      ev_ebitda: target.ev_ebitda,
      net_margin: target.net_margin,
      roe: target.roe,
      revenue_growth: target.revenue_growth,
      market_cap: target.market_cap,
    } as PeerStock,
    ...peers,
  ]

  const cols = [
    { key: "pe_ratio" as keyof PeerStock, label: "PE", lower: true },
    { key: "forward_pe" as keyof PeerStock, label: "Fwd PE", lower: true },
    { key: "pb_ratio" as keyof PeerStock, label: "PB", lower: true },
    { key: "ps_ratio" as keyof PeerStock, label: "PS", lower: true },
    { key: "peg_ratio" as keyof PeerStock, label: "PEG", lower: true },
    { key: "ev_ebitda" as keyof PeerStock, label: "EV/EBITDA", lower: true },
  ]

  // Compute peer averages for benchmark
  const peerAvg = (key: keyof PeerStock): number | null => {
    const vals = peers.map(p => p[key] as number | null).filter(v => v !== null && v > 0) as number[]
    return vals.length > 0 ? vals.reduce((a, b) => a + b) / vals.length : null
  }

  return (
    <div className="overflow-x-auto">
      {/* Peer avg row */}
      <div className="mb-3 flex flex-wrap gap-3">
        {cols.map(c => {
          const avg = peerAvg(c.key)
          const tgt = target[c.key as keyof StockOverview] as number | null
          if (!avg || !tgt) return null
          const expensive = c.lower ? tgt > avg * 1.2 : tgt < avg * 0.8
          return (
            <div key={c.key} className="text-xs bg-[var(--card)] border border-[var(--border)] rounded px-2.5 py-1.5">
              <span className="text-gray-500">{c.label} 同行均值：</span>
              <span className="text-gray-300">{avg.toFixed(1)}x</span>
              <span className="mx-1">·</span>
              <span className="text-gray-500">目标股：</span>
              <span className={expensive ? "text-amber-400 font-bold" : "text-emerald-400"}>{tgt.toFixed(1)}x</span>
              {expensive && <span className="ml-1 text-amber-400">▲ 溢价</span>}
            </div>
          )
        })}
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left text-gray-500 py-2 pr-4 font-medium">公司</th>
            {cols.map(c => (
              <th key={c.key} className="text-right text-gray-500 py-2 px-2 font-medium">{c.label}</th>
            ))}
            <th className="text-right text-gray-500 py-2 px-2 font-medium">净利率</th>
            <th className="text-right text-gray-500 py-2 px-2 font-medium">ROE</th>
            <th className="text-right text-gray-500 py-2 px-2 font-medium">营收增长</th>
          </tr>
        </thead>
        <tbody>
          {allStocks.map((s, i) => {
            const isTarget = i === 0
            return (
              <tr
                key={s.ticker}
                className={clsx(
                  "border-b border-[var(--border)]/50",
                  isTarget ? "bg-blue-500/5 border-blue-500/20" : "hover:bg-gray-800/30"
                )}
              >
                <td className="py-2 pr-4">
                  <span className={clsx("font-mono font-bold", isTarget ? "text-blue-400" : "text-gray-300")}>
                    {s.ticker}
                  </span>
                  {isTarget && <span className="ml-1.5 text-[10px] bg-blue-500/20 text-blue-400 px-1 rounded">目标</span>}
                </td>
                {cols.map(c => (
                  <td key={c.key} className="text-right py-2 px-2">
                    <Cell v={s[c.key] as number | null} />
                  </td>
                ))}
                <td className="text-right py-2 px-2">{pctCell(s.net_margin)}</td>
                <td className="text-right py-2 px-2">{pctCell(s.roe)}</td>
                <td className="text-right py-2 px-2">{pctCell(s.revenue_growth)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
