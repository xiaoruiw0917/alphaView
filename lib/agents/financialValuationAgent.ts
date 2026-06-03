import Anthropic from "@anthropic-ai/sdk"
import type { FinancialYear, PeerStock, StockOverview, FinancialValuationResult } from "@/lib/types/stock"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是专业财务与估值分析师。你已收到目标公司的结构化财务数据（JSON 格式，由代码计算好），包括 Revenue、Gross Profit、Operating Income、Net Income、EPS、Free Cash Flow、ROE、ROA、Debt Ratio、Current Ratio、Net Margin、PE、Forward PE、PB、PS、EV/EBITDA、PEG，以及同行公司的相同指标。

你的任务：
1. 判断公司财务健康度（Strong/Moderate/Weak/Deteriorating），指出具体数据依据
2. 从巴菲特视角判断：是否有护城河？ROE 是否稳定 5 年以上？现金流质量？是否依赖高杠杆？
3. 与同行比较估值，判断：Undervalued / Fair / Expensive / Extremely Expensive
4. 如果是"好公司但太贵"，明确说明
5. buffett_score：0-100 分，综合稳定盈利、护城河、现金流、低杠杆、合理估值

结论只能使用以下之一：
Worth Watching | Financially Strong but Expensive | Long-term Compounder Candidate | Undervalued Relative to Peers | Weak Financial Stability | High Growth High Valuation Risk

必须输出合法 JSON，不要输出任何 JSON 以外的内容：
{
  "financial_health": "Strong|Moderate|Weak|Deteriorating",
  "moat_assessment": "string（100字内）",
  "cash_flow_quality": "Excellent|Good|Fair|Poor",
  "leverage_risk": "Low|Medium|High",
  "valuation_status": "Undervalued|Fair|Expensive|Extremely Expensive",
  "peer_rank": "1st Quartile|2nd Quartile|3rd Quartile|4th Quartile",
  "upside_risk": "Low|Medium|High",
  "buffett_score": number,
  "conclusion": "string",
  "summary": "string（200字内中文）"
}`

export async function runFinancialValuationAgent(
  overview: StockOverview,
  financials: FinancialYear[],
  peers: PeerStock[]
): Promise<FinancialValuationResult> {
  const userMsg = JSON.stringify({
    ticker: overview.ticker,
    company: overview.company_name,
    sector: overview.sector,
    current_metrics: {
      pe: overview.pe_ratio,
      forward_pe: overview.forward_pe,
      pb: overview.pb_ratio,
      ps: overview.ps_ratio,
      peg: overview.peg_ratio,
      ev_ebitda: overview.ev_ebitda,
      roe: overview.roe,
      roa: overview.roa,
      gross_margin: overview.gross_margin,
      net_margin: overview.net_margin,
      debt_to_equity: overview.debt_to_equity,
      current_ratio: overview.current_ratio,
      revenue_growth: overview.revenue_growth,
      fcf: overview.free_cashflow,
    },
    annual_financials: financials.slice(-5),
    peer_comparison: peers.slice(0, 6),
  }, null, 0)

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  })

  const text = (msg.content[0] as { text: string }).text.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Financial agent returned no JSON")
  return JSON.parse(jsonMatch[0]) as FinancialValuationResult
}
