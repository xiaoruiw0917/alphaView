"use client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts"
import type { FinancialYear } from "@/lib/types/stock"

function fmtB(v: number | null) {
  if (v === null) return "N/A"
  const b = v / 1e9
  return `$${b.toFixed(1)}B`
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-[#1a2232] border border-[var(--border)] rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2 font-semibold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="mb-0.5">
          {p.name}: {fmtB(p.value)}
        </p>
      ))}
    </div>
  )
}

const MarginTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-[#1a2232] border border-[var(--border)] rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2 font-semibold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="mb-0.5">
          {p.name}: {((p.value ?? 0) * 100).toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

export function FinancialBarChart({ data }: { data: FinancialYear[] }) {
  const revenueData = data.map(d => ({ year: d.year, Revenue: d.revenue, "Net Income": d.net_income, "Free CF": d.free_cash_flow }))
  const marginData = data.map(d => ({ year: d.year, "Gross Margin": d.gross_margin, "Net Margin": d.net_margin, ROE: d.roe, ROA: d.roa }))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Revenue / Net Income / Free Cash Flow</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenueData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="year" tick={{ fill: "#6b7280", fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${(v / 1e9).toFixed(0)}B`} tick={{ fill: "#6b7280", fontSize: 10 }} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            <Bar dataKey="Revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Net Income" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Free CF" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Margins & Returns (%)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={marginData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="year" tick={{ fill: "#6b7280", fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: "#6b7280", fontSize: 10 }} width={45} />
            <Tooltip content={<MarginTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            <Line type="monotone" dataKey="Gross Margin" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Net Margin" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ROE" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ROA" stroke="#8b5cf6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
