import type { StockOverview } from "@/lib/types/stock"
import { MetricCard } from "@/components/ui/MetricCard"

function pct(v: number | null, dec = 1) {
  if (v == null) return null
  return `${(v * 100).toFixed(dec)}%`
}
function money(v: number | null) {
  if (v == null) return null
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}
function num(v: number | null, dec = 2, suffix = "") {
  if (v == null) return null
  return `${v.toFixed(dec)}${suffix}`
}

export function MetricGrid({ data }: { data: StockOverview }) {
  const metrics = [
    {
      label: "毛利率",
      value: pct(data.gross_margin),
      color: (data.gross_margin ?? 0) > 0.4 ? "green" : (data.gross_margin ?? 0) > 0.2 ? "yellow" : "red",
    },
    {
      label: "营业利润率",
      value: pct(data.operating_margin),
      color: (data.operating_margin ?? 0) > 0.15 ? "green" : (data.operating_margin ?? 0) > 0 ? "yellow" : "red",
    },
    {
      label: "净利润率",
      value: pct(data.net_margin),
      color: (data.net_margin ?? 0) > 0.1 ? "green" : (data.net_margin ?? 0) > 0 ? "yellow" : "red",
    },
    {
      label: "净资产收益率",
      value: pct(data.roe),
      color: (data.roe ?? 0) > 0.15 ? "green" : (data.roe ?? 0) > 0.05 ? "yellow" : "red",
      sub: ">15% 为优",
    },
    {
      label: "资产回报率",
      value: pct(data.roa),
      color: (data.roa ?? 0) > 0.07 ? "green" : "default",
    },
    {
      label: "负债权益比",
      value: num(data.debt_to_equity, 2, "x"),
      color: (data.debt_to_equity ?? 0) < 0.5 ? "green" : (data.debt_to_equity ?? 0) < 1.5 ? "yellow" : "red",
      sub: "<0.5x 为健康",
    },
    {
      label: "流动比率",
      value: num(data.current_ratio, 2, "x"),
      color: (data.current_ratio ?? 0) > 1.5 ? "green" : (data.current_ratio ?? 0) > 1 ? "yellow" : "red",
    },
    {
      label: "自由现金流",
      value: money(data.free_cashflow),
      color: (data.free_cashflow ?? 0) > 0 ? "green" : "red",
    },
    {
      label: "营收增长",
      value: pct(data.revenue_growth),
      color: (data.revenue_growth ?? 0) > 0.1 ? "green" : (data.revenue_growth ?? 0) > 0 ? "yellow" : "red",
    },
    {
      label: "每股收益",
      value: num(data.eps, 2, ""),
      color: (data.eps ?? 0) > 0 ? "green" : "red",
      sub: `预期：${data.forward_eps?.toFixed(2) ?? "—"}`,
    },
    {
      label: "股息率",
      value: pct(data.dividend_yield),
      color: "blue",
    },
    {
      label: "目标价格",
      value: data.target_price ? `$${data.target_price.toFixed(2)}` : null,
      color: data.target_price && data.price && data.target_price > data.price ? "green" : "red",
      sub: data.target_price && data.price
        ? `${((data.target_price / data.price - 1) * 100).toFixed(1)}% 上涨空间`
        : undefined,
    },
  ] as const

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {metrics.map((m) => (
        <MetricCard
          key={m.label}
          label={m.label}
          value={m.value}
          color={m.color as "green" | "red" | "yellow" | "blue" | "default"}
          sub={"sub" in m ? m.sub : undefined}
        />
      ))}
    </div>
  )
}
