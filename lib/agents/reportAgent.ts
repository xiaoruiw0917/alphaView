import Anthropic from "@anthropic-ai/sdk"
import type {
  StockOverview, FinancialValuationResult,
  IndustrySupplyChainResult, TechnicalRiskResult, FullReport
} from "@/lib/types/stock"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是机构级中文投研报告生成官。你已收到结构化的分析数据，包括基础信息、财务估值分析、产业链行业趋势、技术面与风险评估。

你的任务：生成一份专业中文投研报告。报告必须：
1. 引用具体财务数字和指标
2. 分析产业链位置和竞争优势
3. 评估估值合理性
4. 指出核心风险

结论只能使用以下之一：
Worth Watching | Financially Strong but Expensive | Long-term Compounder Candidate | Undervalued Relative to Peers | Weak Financial Stability | High Growth High Valuation Risk | High Momentum High Risk

禁止使用：买入、卖出、强烈推荐、一定涨、必须持有。

必须输出合法 JSON，不要输出任何 JSON 以外的内容：
{
  "investment_summary": "string（3-4句话投资摘要）",
  "business_overview": "string（公司业务简介100字内）",
  "financial_health_section": "string（财务健康度分析200字内，引用具体数据）",
  "valuation_section": "string（估值分析150字内，与同行对比）",
  "supply_chain_section": "string（产业链位置分析150字内）",
  "industry_trend_section": "string（行业趋势分析200字内，5-10年展望）",
  "policy_section": "string（政策影响分析100字内）",
  "technical_section": "string（技术面信号100字内）",
  "key_risks": ["string（每条风险50字内）"],
  "long_term_score": number,
  "conclusion": "string",
  "disclaimer": "本报告仅供参考，不构成投资建议。投资有风险，入市需谨慎。"
}`

export async function runReportAgent(
  overview: StockOverview,
  financial: FinancialValuationResult,
  industry: IndustrySupplyChainResult,
  technical: TechnicalRiskResult,
  macroSummary: string
): Promise<FullReport> {
  const userMsg = JSON.stringify({
    ticker: overview.ticker,
    company: overview.company_name,
    sector: overview.sector,
    price: overview.price,
    market_cap: overview.market_cap,
    analyst_rating: overview.analyst_rating,
    financial_analysis: financial,
    industry_analysis: industry,
    technical_analysis: technical,
    macro_context: macroSummary,
  }, null, 0)

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  })

  const text = (msg.content[0] as { text: string }).text.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Report agent returned no JSON")
  const report = JSON.parse(jsonMatch[0]) as Omit<FullReport, "ticker" | "generated_at">
  return { ...report, ticker: overview.ticker, generated_at: new Date().toISOString() }
}
