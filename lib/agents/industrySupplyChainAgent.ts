import Anthropic from "@anthropic-ai/sdk"
import type { StockOverview, IndustrySupplyChainResult } from "@/lib/types/stock"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是产业链研究员。你已收到目标公司的行业、产品线、主要客户、主要供应商信息。

你的任务：
1. 画出产业链图（上游供应商 → 中游环节 → 下游客户），每层列出主要美股公司和 ticker（优先美股）
2. 分析竞争对手和替代技术风险
3. 判断目标公司在产业链中的位置和议价能力（Strong/Moderate/Weak）
4. 分析该行业未来 5-10 年：市场空间（十亿美元）、增长驱动、周期阶段、主要风险
5. 识别产业链中最先受益环节和被挤压利润环节

必须输出合法 JSON，不要输出任何 JSON 以外的内容：
{
  "upstream": [{"ticker":"string", "company":"string", "role":"string"}],
  "midstream": [{"ticker":"string", "company":"string", "role":"string"}],
  "downstream": [{"ticker":"string", "company":"string", "role":"string"}],
  "competitors": [{"ticker":"string", "company":"string", "threat_level":"Low|Medium|High"}],
  "bargaining_power": "Strong|Moderate|Weak",
  "supply_chain_position": "string（50字内）",
  "industry_outlook": "High Growth|Moderate Growth|Mature|Cyclical|Speculative",
  "market_size_usd_bn": number,
  "cagr_5yr_pct": number,
  "cycle_stage": "Early|Growth|Peak|Declining",
  "key_risks": ["string"],
  "most_benefited_segment": "string",
  "margin_squeeze_segment": "string",
  "summary": "string（200字内中文）"
}`

export async function runIndustrySupplyChainAgent(
  overview: StockOverview
): Promise<IndustrySupplyChainResult> {
  const userMsg = JSON.stringify({
    ticker: overview.ticker,
    company: overview.company_name,
    sector: overview.sector,
    industry: overview.industry,
    description: overview.description,
  }, null, 0)

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  })

  const text = (msg.content[0] as { text: string }).text.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Industry agent returned no JSON")
  return JSON.parse(jsonMatch[0]) as IndustrySupplyChainResult
}
