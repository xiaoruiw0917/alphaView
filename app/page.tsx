import { SearchBar } from "@/components/search/SearchBar"
import Link from "next/link"

const POPULAR = [
  { ticker: "NVDA", label: "英伟达" },
  { ticker: "AAPL", label: "苹果" },
  { ticker: "MSFT", label: "微软" },
  { ticker: "TSLA", label: "特斯拉" },
  { ticker: "AMD", label: "超微半导体" },
  { ticker: "META", label: "Meta" },
  { ticker: "GOOGL", label: "谷歌" },
  { ticker: "AMZN", label: "亚马逊" },
]

const FEATURES = [
  { icon: "📊", title: "财务报表分析", desc: "5-10 年营收、利润率、ROE、自由现金流 — 巴菲特式价值评估" },
  { icon: "⚖️", title: "同行估值对比", desc: "PE、PB、EV/EBITDA、PEG 与行业龙头横向比较" },
  { icon: "🔗", title: "产业链地图", desc: "上游供应商 → 中游核心 → 下游客户全景梳理" },
  { icon: "📈", title: "技术面信号", desc: "MA20/50/200、RSI、MACD、支撑位与压力位分析" },
  { icon: "🤖", title: "AI 投研报告", desc: "多 Agent 协同：财务 + 产业链 + 技术面综合分析" },
  { icon: "🔥", title: "今日热点推荐", desc: "基于实时新闻的 AI 美股筛选，含热度评分排名" },
]

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] py-12 text-center">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight">
          <span className="text-blue-400">Alpha</span><span className="text-white">View</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
          AI 驱动的机构级美股投研平台。财务分析、估值对比、产业链研究、技术面信号——秒级生成。
        </p>
        <p className="text-xs text-gray-600 mt-2">仅供研究参考 · 不构成投资建议</p>
      </div>

      {/* 搜索框 */}
      <div className="w-full max-w-2xl mb-8">
        <SearchBar />
      </div>

      {/* 热门股票 */}
      <div className="mb-10">
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">热门股票</p>
        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR.map(p => (
            <Link
              key={p.ticker}
              href={`/stock/${p.ticker}`}
              className="px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm font-mono text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
            >
              {p.ticker}
              <span className="text-gray-500 ml-1.5 font-sans text-xs">{p.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 功能介绍 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        {FEATURES.map(f => (
          <div key={f.title} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left">
            <div className="text-2xl mb-2">{f.icon}</div>
            <h3 className="text-sm font-semibold text-white mb-1">{f.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* 热点入口 */}
      <div className="mt-8">
        <Link
          href="/hot-stocks"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 text-orange-400 hover:border-orange-500/60 transition-all text-sm font-medium"
        >
          <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
          查看今日热点美股
        </Link>
      </div>
    </div>
  )
}
