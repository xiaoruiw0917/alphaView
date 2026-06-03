"use client"
import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import { SearchBar } from "@/components/search/SearchBar"
import { StockHeader } from "@/components/dashboard/StockHeader"
import { MetricGrid } from "@/components/dashboard/MetricGrid"
import { FinancialsTable } from "@/components/financials/FinancialsTable"
import { FinancialBarChart } from "@/components/charts/FinancialBarChart"
import { PeerComparison } from "@/components/valuation/PeerComparison"
import { SupplyChainMap } from "@/components/industry/SupplyChainMap"
import { AIReport, FinancialAnalysisCard, TechnicalCard } from "@/components/report/AIReport"
import { SectionCard } from "@/components/ui/SectionCard"
import { MetricGridSkeleton, ChartSkeleton, LoadingSkeleton } from "@/components/ui/LoadingSkeleton"
import type {
  StockOverview, FinancialYear, PeerStock,
  FinancialValuationResult, IndustrySupplyChainResult,
  TechnicalRiskResult, FullReport
} from "@/lib/types/stock"

// TradingView chart must be client-side only
const CandlestickChart = dynamic(() => import("@/components/charts/CandlestickChart"), { ssr: false })

type Tab = "overview" | "financials" | "valuation" | "technical" | "ai_analysis" | "report"

interface TechData {
  bars: Array<{
    time: string; open: number; high: number; low: number; close: number; volume: number;
    ma20?: number; ma50?: number; ma200?: number; rsi?: number
  }>
  technicals: {
    ma20: number | null; ma50: number | null; ma200: number | null; rsi: number | null
    volume_ratio: number | null; support: number | null; resistance: number | null
  }
}

export default function StockPage() {
  const params = useParams()
  const ticker = (params.ticker as string)?.toUpperCase()

  const [tab, setTab] = useState<Tab>("overview")
  const [overview, setOverview] = useState<StockOverview | null>(null)
  const [financials, setFinancials] = useState<FinancialYear[] | null>(null)
  const [peers, setPeers] = useState<PeerStock[] | null>(null)
  const [techData, setTechData] = useState<TechData | null>(null)

  // AI results (loaded on demand)
  const [aiFinancial, setAiFinancial] = useState<FinancialValuationResult | null>(null)
  const [aiIndustry, setAiIndustry] = useState<IndustrySupplyChainResult | null>(null)
  const [aiTechnical, setAiTechnical] = useState<TechnicalRiskResult | null>(null)
  const [fullReport, setFullReport] = useState<FullReport | null>(null)

  const [loading, setLoading] = useState({ overview: true, financials: false, technicals: false, ai: false, report: false })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load overview on mount
  useEffect(() => {
    if (!ticker) return
    setLoading(l => ({ ...l, overview: true }))
    fetch(`/api/stock/${ticker}`)
      .then(r => r.json())
      .then(d => { setOverview(d); setLoading(l => ({ ...l, overview: false })) })
      .catch(e => { setErrors(prev => ({ ...prev, overview: String(e) })); setLoading(l => ({ ...l, overview: false })) })
  }, [ticker])

  // Load financials when tab activated
  useEffect(() => {
    if ((tab === "financials" || tab === "valuation") && !financials && !loading.financials) {
      setLoading(l => ({ ...l, financials: true }))
      fetch(`/api/financials/${ticker}`)
        .then(r => r.json())
        .then(d => { setFinancials(d.financials?.annual || []); setPeers(d.peers || []); setLoading(l => ({ ...l, financials: false })) })
        .catch(() => setLoading(l => ({ ...l, financials: false })))
    }
  }, [tab, ticker, financials, loading.financials])

  // Load technicals when tab activated
  useEffect(() => {
    if (tab === "technical" && !techData && !loading.technicals) {
      setLoading(l => ({ ...l, technicals: true }))
      fetch(`/api/technicals/${ticker}?period=1y`)
        .then(r => r.json())
        .then(d => { setTechData(d); setLoading(l => ({ ...l, technicals: false })) })
        .catch(() => setLoading(l => ({ ...l, technicals: false })))
    }
  }, [tab, ticker, techData, loading.technicals])

  const loadAIAnalysis = useCallback(async () => {
    if (aiFinancial && aiIndustry) return
    setLoading(l => ({ ...l, ai: true }))
    try {
      const [finRes, indRes] = await Promise.all([
        fetch(`/api/report/${ticker}?mode=financial_analysis`, { method: "POST" }),
        fetch(`/api/report/${ticker}?mode=industry_research`, { method: "POST" }),
      ])
      const [finData, indData] = await Promise.all([finRes.json(), indRes.json()])
      if (finData.result) setAiFinancial(finData.result)
      if (indData.result) setAiIndustry(indData.result)

      // Also load technical AI if we have tech data
      if (techData) {
        const techRes = await fetch(`/api/report/${ticker}?mode=technical_alert`, { method: "POST" })
        const techData2 = await techRes.json()
        if (techData2.result) setAiTechnical(techData2.result)
      }
    } catch (e) {
      setErrors(prev => ({ ...prev, ai: String(e) }))
    } finally {
      setLoading(l => ({ ...l, ai: false }))
    }
  }, [ticker, aiFinancial, aiIndustry, techData])

  const loadFullReport = useCallback(async () => {
    if (fullReport) return
    setLoading(l => ({ ...l, report: true }))
    try {
      const res = await fetch(`/api/report/${ticker}?mode=full_report`, { method: "POST" })
      const d = await res.json()
      if (d.report) setFullReport(d.report)
      if (d.financial) setAiFinancial(d.financial)
      if (d.industry) setAiIndustry(d.industry)
      if (d.technical) setAiTechnical(d.technical)
    } catch (e) {
      setErrors(prev => ({ ...prev, report: String(e) }))
    } finally {
      setLoading(l => ({ ...l, report: false }))
    }
  }, [ticker, fullReport])

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "概览" },
    { id: "financials", label: "财务报表" },
    { id: "valuation", label: "估值对比" },
    { id: "technical", label: "技术面" },
    { id: "ai_analysis", label: "AI分析" },
    { id: "report", label: "完整报告" },
  ]

  if (loading.overview) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-[var(--card)] rounded-xl border border-[var(--border)] animate-pulse" />
        <MetricGridSkeleton />
      </div>
    )
  }

  if (errors.overview || (!loading.overview && !overview)) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl text-gray-500 mb-2">股票代码未找到</p>
        <p className="text-gray-600 mb-6">{errors.overview || `"${ticker}" 数据加载失败。`}</p>
        <SearchBar />
      </div>
    )
  }

  if (!overview) return null

  return (
    <div className="space-y-5">
      {/* Search bar compact */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-sm">
          <SearchBar defaultValue={ticker} />
        </div>
      </div>

      {/* Stock header */}
      <StockHeader data={overview} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {/* ─── OVERVIEW ─── */}
        {tab === "overview" && (
          <div className="space-y-5">
            <SectionCard title="核心指标" subtitle="来自 Yahoo Finance 的最新数据">
              <MetricGrid data={overview} />
            </SectionCard>

            {overview.description && (
              <SectionCard title="公司简介">
                <p className="text-sm text-gray-300 leading-relaxed">{overview.description}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {overview.employees && (
                    <div>
                      <p className="text-xs text-gray-500">员工人数</p>
                      <p className="text-sm font-semibold text-white">{overview.employees.toLocaleString()}</p>
                    </div>
                  )}
                  {overview.website && (
                    <div>
                      <p className="text-xs text-gray-500">官网</p>
                      <a href={overview.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline truncate block">
                        {overview.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ─── FINANCIALS ─── */}
        {tab === "financials" && (
          <div className="space-y-5">
            {loading.financials ? (
              <SectionCard title="财务报表"><LoadingSkeleton rows={8} height="h-5" /></SectionCard>
            ) : financials && financials.length > 0 ? (
              <>
                <SectionCard title="营收与盈利能力" subtitle="5年历史数据">
                  <FinancialBarChart data={financials} />
                </SectionCard>
                <SectionCard title="财务报表" subtitle="年度数据">
                  <FinancialsTable data={financials} />
                </SectionCard>
              </>
            ) : (
              <SectionCard title="财务报表"><p className="text-gray-500 text-sm">加载财务数据中...</p></SectionCard>
            )}
          </div>
        )}

        {/* ─── VALUATION ─── */}
        {tab === "valuation" && (
          <SectionCard title="同行估值对比" subtitle="与行业同行对比">
            {loading.financials ? (
              <LoadingSkeleton rows={6} height="h-8" />
            ) : peers && peers.length > 0 ? (
              <PeerComparison target={overview} peers={peers} />
            ) : (
              <p className="text-gray-500 text-sm">加载同行数据中...</p>
            )}
          </SectionCard>
        )}

        {/* ─── TECHNICAL ─── */}
        {tab === "technical" && (
          <div className="space-y-5">
            <SectionCard title="价格走势图" subtitle="K线 + MA20/50/200 + 成交量">
              {loading.technicals ? (
                <ChartSkeleton />
              ) : techData ? (
                <CandlestickChart bars={techData.bars} ticker={ticker} />
              ) : (
                <ChartSkeleton />
              )}
            </SectionCard>

            {aiTechnical ? (
              <SectionCard title="技术面与风险分析" subtitle="AI驱动信号解读">
                <TechnicalCard data={aiTechnical} />
              </SectionCard>
            ) : (
              <SectionCard title="技术面分析" action={
                <button
                  onClick={() => loadAIAnalysis()}
                  disabled={loading.ai}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {loading.ai ? "分析中..." : "运行AI分析"}
                </button>
              }>
                <p className="text-sm text-gray-500">点击"运行AI分析"获取AI驱动的技术面信号解读。</p>
                {techData && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
                    {[
                      ["MA20", techData.technicals.ma20?.toFixed(2)],
                      ["MA50", techData.technicals.ma50?.toFixed(2)],
                      ["MA200", techData.technicals.ma200?.toFixed(2)],
                      ["RSI", techData.technicals.rsi?.toFixed(1)],
                      ["成交量比", techData.technicals.volume_ratio?.toFixed(2) + "x"],
                      ["支撑位", "$" + techData.technicals.support?.toFixed(2)],
                    ].map(([l, v]) => (
                      <div key={l} className="bg-[var(--card)] border border-[var(--border)] rounded p-2 text-center">
                        <p className="text-[10px] text-gray-500">{l}</p>
                        <p className="text-xs font-semibold text-white">{v ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        )}

        {/* ─── AI ANALYSIS ─── */}
        {tab === "ai_analysis" && (
          <div className="space-y-5">
            {!aiFinancial && !aiIndustry && !loading.ai && (
              <div className="text-center py-12 border border-[var(--border)] rounded-xl bg-[var(--card)]">
                <p className="text-gray-400 mb-4"><span className="text-blue-400 font-mono">{ticker}</span> 的财务与产业链AI分析</p>
                <p className="text-xs text-gray-500 mb-6">运行财务估值Agent + 产业链Agent（约15-30秒）</p>
                <button
                  onClick={loadAIAnalysis}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
                >
                  运行AI分析
                </button>
              </div>
            )}

            {loading.ai && (
              <SectionCard title="AI分析运行中...">
                <LoadingSkeleton rows={6} height="h-4" />
                <p className="text-xs text-gray-500 mt-3 animate-pulse">正在调用Claude agents...（15-30秒）</p>
              </SectionCard>
            )}

            {aiFinancial && (
              <SectionCard title="财务与估值分析" subtitle="巴菲特风格评估（Claude驱动）">
                <FinancialAnalysisCard data={aiFinancial} />
              </SectionCard>
            )}

            {aiIndustry && (
              <SectionCard title="产业链与行业趋势" subtitle="上游→下游分析（Claude驱动）">
                <SupplyChainMap data={aiIndustry} />
              </SectionCard>
            )}

            {errors.ai && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                Error: {errors.ai}
              </div>
            )}
          </div>
        )}

        {/* ─── FULL REPORT ─── */}
        {tab === "report" && (
          <div className="space-y-5">
            {!fullReport && !loading.report && (
              <div className="text-center py-12 border border-[var(--border)] rounded-xl bg-[var(--card)]">
                <p className="text-gray-400 mb-2">生成完整AI投研报告</p>
                <p className="text-xs text-gray-500 mb-2">并行运行4个Agent后综合分析（约30-60秒）</p>
                <p className="text-xs text-amber-400/70 mb-6">⚠ 将消耗多次Claude API调用</p>
                <button
                  onClick={loadFullReport}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all"
                >
                  生成完整报告
                </button>
              </div>
            )}

            {loading.report && (
              <SectionCard title="正在生成投研报告...">
                <LoadingSkeleton rows={10} height="h-4" />
                <p className="text-xs text-gray-500 mt-3 animate-pulse">
                  并行运行财务+产业链+技术面Agent，综合分析中...（30-60秒）
                </p>
              </SectionCard>
            )}

            {fullReport && (
              <SectionCard title={`${ticker} — AI投研报告`} subtitle={`由Claude生成 · ${new Date(fullReport.generated_at).toLocaleDateString()}`}>
                <AIReport report={fullReport} />
              </SectionCard>
            )}

            {errors.report && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                Error: {errors.report}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
