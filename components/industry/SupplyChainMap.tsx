import type { IndustrySupplyChainResult } from "@/lib/types/stock"
import { Badge } from "@/components/ui/Badge"
import Link from "next/link"

function ChainColumn({ title, items, color }: {
  title: string
  items: Array<{ ticker: string; company: string; role: string }>
  color: string
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${color}`}>{title}</div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-gray-600 italic">暂无数据</p>
        ) : items.map((item, i) => (
          <div key={i} className="bg-[var(--bg-DEFAULT,#0a0e1a)] border border-[var(--border)] rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              {item.ticker && item.ticker !== "N/A" ? (
                <Link href={`/stock/${item.ticker}`} className="font-mono text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">
                  {item.ticker}
                </Link>
              ) : (
                <span className="font-mono text-xs font-bold text-gray-400">{item.ticker}</span>
              )}
            </div>
            <p className="text-xs text-white leading-snug">{item.company}</p>
            {item.role && <p className="text-[10px] text-gray-500 mt-0.5">{item.role}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SupplyChainMap({ data }: { data: IndustrySupplyChainResult }) {
  return (
    <div className="space-y-5">
      {/* Chain visualization */}
      <div className="flex gap-3 items-stretch">
        <ChainColumn title="⬆ 上游" items={data.upstream} color="text-purple-400" />
        <div className="flex items-center text-gray-700 text-lg shrink-0">→</div>
        <ChainColumn title="◆ 中游" items={data.midstream} color="text-blue-400" />
        <div className="flex items-center text-gray-700 text-lg shrink-0">→</div>
        <ChainColumn title="⬇ 下游" items={data.downstream} color="text-emerald-400" />
      </div>

      {/* Competitors */}
      {data.competitors.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">竞争对手</h4>
          <div className="flex flex-wrap gap-2">
            {data.competitors.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded px-2.5 py-1.5">
                <Link href={`/stock/${c.ticker}`} className="font-mono text-xs text-blue-400 font-bold hover:text-blue-300">
                  {c.ticker}
                </Link>
                <span className="text-xs text-gray-400">{c.company}</span>
                <Badge
                  label={c.threat_level}
                  variant={c.threat_level === "High" ? "red" : c.threat_level === "Medium" ? "yellow" : "green"}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">议价能力</p>
          <Badge
            label={data.bargaining_power}
            variant={data.bargaining_power === "Strong" ? "green" : data.bargaining_power === "Moderate" ? "yellow" : "red"}
          />
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">行业展望</p>
          <Badge
            label={data.industry_outlook}
            variant={data.industry_outlook === "High Growth" ? "green" : data.industry_outlook === "Speculative" ? "red" : "blue"}
          />
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">市场规模</p>
          <p className="text-sm font-bold text-white">${data.market_size_usd_bn?.toFixed(0) ?? "—"}B</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">5年复合增速</p>
          <p className="text-sm font-bold text-emerald-400">{data.cagr_5yr_pct?.toFixed(1) ?? "—"}%</p>
        </div>
      </div>

      {/* Key risks */}
      {data.key_risks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">核心行业风险</h4>
          <div className="flex flex-wrap gap-2">
            {data.key_risks.map((r, i) => (
              <span key={i} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <p className="text-sm text-gray-300 leading-relaxed bg-gray-900/50 rounded-lg p-3 border border-[var(--border)]/50">
          {data.summary}
        </p>
      )}
    </div>
  )
}
