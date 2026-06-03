import type { FullReport, FinancialValuationResult, TechnicalRiskResult } from "@/lib/types/stock"
import { Badge, conclusionVariant, riskVariant, trendVariant } from "@/components/ui/Badge"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border)]/50 pb-4 last:border-0 last:pb-0">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      <div className="text-sm text-gray-200 leading-relaxed">{children}</div>
    </div>
  )
}

export function AIReport({ report }: { report: FullReport }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">综合评分</span>
          <span className={`text-2xl font-bold ${report.long_term_score >= 70 ? "text-emerald-400" : report.long_term_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
            {report.long_term_score}
            <span className="text-sm text-gray-500">/100</span>
          </span>
        </div>
        <Badge label={report.conclusion} variant={conclusionVariant(report.conclusion)} />
      </div>

      {/* Score bar */}
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${report.long_term_score >= 70 ? "bg-emerald-500" : report.long_term_score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${report.long_term_score}%` }}
        />
      </div>

      <div className="space-y-4">
        <Section title="投资摘要">{report.investment_summary}</Section>
        <Section title="公司简介">{report.business_overview}</Section>
        <Section title="财务健康度">{report.financial_health_section}</Section>
        <Section title="估值水平">{report.valuation_section}</Section>
        <Section title="产业链地位">{report.supply_chain_section}</Section>
        <Section title="行业趋势（5-10年）">{report.industry_trend_section}</Section>
        <Section title="政策影响">{report.policy_section}</Section>
        <Section title="技术面信号">{report.technical_section}</Section>

        {report.key_risks.length > 0 && (
          <div className="border-b border-[var(--border)]/50 pb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">核心风险</h3>
            <ul className="space-y-1.5">
              {report.key_risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-red-400 mt-0.5">⚠</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600 italic mt-2">{report.disclaimer}</p>
      <p className="text-[10px] text-gray-700">生成时间：{new Date(report.generated_at).toLocaleString()}</p>
    </div>
  )
}

export function FinancialAnalysisCard({ data }: { data: FinancialValuationResult }) {
  const healthColor = {
    Strong: "text-emerald-400",
    Moderate: "text-amber-400",
    Weak: "text-red-400",
    Deteriorating: "text-red-500",
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">财务健康度</p>
          <p className={`text-sm font-bold ${healthColor[data.financial_health]}`}>{data.financial_health}</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">估值状态</p>
          <Badge
            label={data.valuation_status}
            variant={data.valuation_status === "Undervalued" ? "green" : data.valuation_status === "Fair" ? "blue" : data.valuation_status === "Expensive" ? "yellow" : "red"}
          />
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">巴菲特评分</p>
          <p className={`text-lg font-bold ${data.buffett_score >= 70 ? "text-emerald-400" : data.buffett_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
            {data.buffett_score}<span className="text-xs text-gray-500">/100</span>
          </p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">杠杆风险</p>
          <Badge label={data.leverage_risk} variant={data.leverage_risk === "Low" ? "green" : data.leverage_risk === "Medium" ? "yellow" : "red"} />
        </div>
      </div>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 space-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">护城河评估</p>
          <p className="text-sm text-gray-200">{data.moat_assessment}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">分析摘要</p>
          <p className="text-sm text-gray-200 leading-relaxed">{data.summary}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Badge label={data.conclusion} variant={conclusionVariant(data.conclusion)} />
        <span className="text-xs text-gray-500">同行排名：{data.peer_rank}</span>
      </div>
    </div>
  )
}

export function TechnicalCard({ data }: { data: TechnicalRiskResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge label={data.trend} variant={trendVariant(data.trend)} />
        <Badge label={`RSI: ${data.rsi?.toFixed(1) ?? "—"} — ${data.rsi_signal}`} variant={data.rsi_signal === "Overbought" ? "red" : data.rsi_signal === "Oversold" ? "green" : "gray"} />
        <Badge label={`MACD: ${data.macd_signal}`} variant={data.macd_signal === "Bullish" ? "green" : data.macd_signal === "Bearish" ? "red" : "gray"} />
        {data.volume_alert && <Badge label={`放量预警 ${data.volume_ratio?.toFixed(1)}x`} variant="yellow" />}
        <Badge label={`风险：${data.overall_risk}`} variant={riskVariant(data.overall_risk)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["MA20", data.ma20?.toFixed(2)],
          ["MA50", data.ma50?.toFixed(2)],
          ["MA200", data.ma200?.toFixed(2)],
          ["vs MA200", data.price_vs_ma200_pct !== null ? `${data.price_vs_ma200_pct > 0 ? "+" : ""}${data.price_vs_ma200_pct?.toFixed(1)}%` : "—"],
          ["支撑位", `$${data.support_level?.toFixed(2) ?? "—"}`],
          ["压力位", `$${data.resistance_level?.toFixed(2) ?? "—"}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-sm font-semibold text-white">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      {data.risk_flags.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">风险标记</p>
          <div className="flex flex-wrap gap-2">
            {data.risk_flags.map((f, i) => (
              <span key={i} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded">{f}</span>
            ))}
          </div>
        </div>
      )}

      {data.risk_summary && (
        <p className="text-sm text-gray-300 bg-gray-900/50 rounded-lg p-3 border border-[var(--border)]/50">
          {data.risk_summary}
        </p>
      )}
    </div>
  )
}
