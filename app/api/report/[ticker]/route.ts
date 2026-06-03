import { NextRequest, NextResponse } from "next/server"
import { fetchOverview, fetchFinancials, fetchPeers, fetchHistory } from "@/lib/services/stockDataService"
import { computeTechnicals } from "@/lib/services/technicalService"
import { fetchMacroData } from "@/lib/services/macroService"
import { routeRequest } from "@/lib/agents/routerAgent"
import { runFinancialValuationAgent } from "@/lib/agents/financialValuationAgent"
import { runIndustrySupplyChainAgent } from "@/lib/agents/industrySupplyChainAgent"
import { runTechnicalRiskAgent } from "@/lib/agents/technicalRiskAgent"
import { runReportAgent } from "@/lib/agents/reportAgent"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const mode = req.nextUrl.searchParams.get("mode") || "full_report"
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  const route = routeRequest(mode)
  if (!route.use_llm) {
    return NextResponse.json({ error: "Use GET /api/stock/[ticker] for basic data" }, { status: 400 })
  }

  try {
    const t = ticker.toUpperCase()

    // Always fetch base data
    const [overview, financialsData, peers, bars, macro] = await Promise.all([
      fetchOverview(t),
      fetchFinancials(t),
      fetchPeers(t),
      fetchHistory(t, "1y"),
      fetchMacroData(),
    ])
    const techResult = computeTechnicals(bars)

    if (mode === "financial_analysis") {
      const result = await runFinancialValuationAgent(overview, financialsData.annual, peers)
      return NextResponse.json({ mode, ticker: t, result })
    }

    if (mode === "industry_research") {
      const result = await runIndustrySupplyChainAgent(overview)
      return NextResponse.json({ mode, ticker: t, result })
    }

    if (mode === "technical_alert") {
      const result = await runTechnicalRiskAgent(overview, techResult)
      return NextResponse.json({ mode, ticker: t, result })
    }

    // full_report: run 3 agents in parallel then synthesize
    const [financial, industry, technical] = await Promise.all([
      runFinancialValuationAgent(overview, financialsData.annual, peers),
      runIndustrySupplyChainAgent(overview),
      runTechnicalRiskAgent(overview, techResult),
    ])

    const report = await runReportAgent(overview, financial, industry, technical, macro.summary)

    return NextResponse.json({
      mode: "full_report",
      ticker: t,
      overview,
      financial,
      industry,
      technical,
      report,
      macro,
    })
  } catch (e) {
    console.error("Report error:", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
