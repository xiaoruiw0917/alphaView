import type { TaskType } from "@/lib/types/stock"

interface RouterDecision {
  task: TaskType
  agents: string[]
  use_llm: boolean
  reason: string
}

export function routeRequest(mode: string): RouterDecision {
  switch (mode) {
    case "stock_basic":
      return { task: "stock_basic", agents: [], use_llm: false, reason: "Pure data fetch, no LLM needed" }

    case "financial_analysis":
      return { task: "financial_analysis", agents: ["financialValuationAgent"], use_llm: true, reason: "Financial + Buffett + valuation analysis" }

    case "industry_research":
      return { task: "industry_research", agents: ["industrySupplyChainAgent"], use_llm: true, reason: "Supply chain and industry trend analysis" }

    case "technical_alert":
      return { task: "technical_alert", agents: ["technicalRiskAgent"], use_llm: true, reason: "Technical indicators + risk flags" }

    case "hot_stocks":
      return { task: "hot_stocks", agents: ["newsHotStockAgent"], use_llm: true, reason: "News-driven hot stock discovery" }

    case "full_report":
      return {
        task: "full_report",
        agents: ["financialValuationAgent", "industrySupplyChainAgent", "technicalRiskAgent", "reportAgent"],
        use_llm: true,
        reason: "Full analysis: all 4 agents run, ReportAgent synthesizes"
      }

    default:
      return { task: "stock_basic", agents: [], use_llm: false, reason: "Default to basic data" }
  }
}
