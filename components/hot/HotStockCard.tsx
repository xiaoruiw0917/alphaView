import type { HotStock } from "@/lib/types/stock"
import { Badge, conclusionVariant, riskVariant } from "@/components/ui/Badge"
import Link from "next/link"

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 w-6 text-right">{value}</span>
    </div>
  )
}

export function HotStockCard({ stock }: { stock: HotStock }) {
  const scoreColor = stock.hot_score >= 70 ? "text-emerald-400" : stock.hot_score >= 50 ? "text-amber-400" : "text-gray-400"

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3 hover:border-blue-500/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/stock/${stock.ticker}`} className="font-mono font-bold text-blue-400 hover:text-blue-300 text-base transition-colors">
              {stock.ticker}
            </Link>
            <Badge label={stock.exchange} variant="gray" />
            <Badge label={stock.supply_chain_position} variant="blue" />
          </div>
          <p className="text-sm text-gray-300 mt-0.5">{stock.company_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">主题：{stock.theme}</p>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-2xl font-bold ${scoreColor}`}>{stock.hot_score}</div>
          <div className="text-[10px] text-gray-500">热度分</div>
        </div>
      </div>

      {/* Benefit logic */}
      <p className="text-xs text-gray-300 leading-relaxed bg-gray-900/50 rounded p-2.5 border border-[var(--border)]/50">
        {stock.benefit_logic}
      </p>

      {/* Score breakdown */}
      <div className="space-y-1">
        <ScoreBar label="新闻热度" value={stock.score_breakdown.news_heat} max={30} />
        <ScoreBar label="来源可信度" value={stock.score_breakdown.credibility} max={15} />
        <ScoreBar label="政策支持" value={stock.score_breakdown.policy} max={15} />
        <ScoreBar label="成长性" value={stock.score_breakdown.growth} max={15} />
        <ScoreBar label="财务质量" value={stock.score_breakdown.financial} max={10} />
        <ScoreBar label="估值" value={stock.score_breakdown.valuation} max={10} />
        <ScoreBar label="技术面" value={stock.score_breakdown.technical} max={5} />
      </div>

      {/* Key news */}
      {stock.key_news.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">重要新闻</p>
          <ul className="space-y-0.5">
            {stock.key_news.slice(0, 2).map((n, i) => (
              <li key={i} className="text-[11px] text-gray-400 flex gap-1.5">
                <span className="text-blue-500 shrink-0">•</span>
                <span className="line-clamp-2">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/50">
        <Badge label={stock.conclusion} variant={conclusionVariant(stock.conclusion)} />
        <Badge label={stock.risk_level} variant={riskVariant(stock.risk_level)} />
      </div>
    </div>
  )
}
