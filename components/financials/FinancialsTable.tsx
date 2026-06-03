import type { FinancialYear } from "@/lib/types/stock"

function fmtB(v: number | null) {
  if (v === null || v === undefined) return <span className="text-gray-600">—</span>
  const b = v / 1e9
  return <span className={v >= 0 ? "text-white" : "text-red-400"}>${b.toFixed(2)}B</span>
}

function fmtPct(v: number | null) {
  if (v === null || v === undefined) return <span className="text-gray-600">—</span>
  const pct = v * 100
  return <span className={pct >= 0 ? "text-emerald-400" : "text-red-400"}>{pct.toFixed(1)}%</span>
}

function fmtNum(v: number | null, dec = 2) {
  if (v === null || v === undefined) return <span className="text-gray-600">—</span>
  return <span className={v >= 0 ? "text-white" : "text-red-400"}>{v.toFixed(dec)}</span>
}

const ROWS: Array<{ label: string; key: keyof FinancialYear; fmt: "B" | "pct" | "num" }> = [
  { label: "营业收入", key: "revenue", fmt: "B" },
  { label: "毛利润", key: "gross_profit", fmt: "B" },
  { label: "营业利润", key: "operating_income", fmt: "B" },
  { label: "净利润", key: "net_income", fmt: "B" },
  { label: "自由现金流", key: "free_cash_flow", fmt: "B" },
  { label: "每股收益", key: "eps", fmt: "num" },
  { label: "毛利率", key: "gross_margin", fmt: "pct" },
  { label: "净利润率", key: "net_margin", fmt: "pct" },
  { label: "净资产收益率", key: "roe", fmt: "pct" },
  { label: "资产回报率", key: "roa", fmt: "pct" },
  { label: "负债比率", key: "debt_ratio", fmt: "num" },
  { label: "流动比率", key: "current_ratio", fmt: "num" },
  { label: "总资产", key: "total_assets", fmt: "B" },
  { label: "总负债", key: "total_liabilities", fmt: "B" },
  { label: "股东权益", key: "shareholders_equity", fmt: "B" },
]

export function FinancialsTable({ data }: { data: FinancialYear[] }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 text-sm">暂无财务数据。</p>
  }

  const years = data.map(d => d.year)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left text-xs text-gray-500 py-2 pr-4 font-medium w-40">指标</th>
            {years.map((y, i) => (
              <th key={`${y ?? "yr"}-${i}`} className="text-right text-xs text-gray-400 py-2 px-2 font-semibold">{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => (
            <tr
              key={row.key}
              className={`border-b border-[var(--border)]/50 hover:bg-gray-800/30 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
            >
              <td className="py-2 pr-4 text-xs text-gray-400 whitespace-nowrap">{row.label}</td>
              {data.map((d, di) => (
                <td key={`${row.key}-${d.year ?? di}`} className="text-right py-2 px-2 tabular-nums text-xs">
                  {row.fmt === "B" ? fmtB(d[row.key] as number | null) :
                    row.fmt === "pct" ? fmtPct(d[row.key] as number | null) :
                      fmtNum(d[row.key] as number | null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
