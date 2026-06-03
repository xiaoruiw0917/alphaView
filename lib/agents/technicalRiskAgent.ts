import Anthropic from "@anthropic-ai/sdk"
import type { StockOverview, TechnicalIndicators, TechnicalRiskResult } from "@/lib/types/stock"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是技术面分析师与风险控制官。你已收到目标股票由代码计算好的技术指标：MA20、MA50、MA200、RSI、MACD、成交量比率、支撑位、压力位，以及公司估值风险指标。

你的任务：
1. 判断当前技术趋势：Uptrend | Sideways | Downtrend | Breakout Watch | Breakdown Risk
2. 识别异常信号：成交量放大 > 1.5x 均量、RSI > 70 超买、RSI < 30 超卖、MACD 金叉/死叉
3. 综合识别风险：估值泡沫（PE 极高）、财务恶化信号、行业周期风险
4. 给出技术面提醒（不是买卖建议）

结论只能使用：Worth Watching | Overheated | Breakout Watch | Support Test | High Risk Momentum
风险级别：Low | Medium | High | Speculative

必须输出合法 JSON，不要输出任何 JSON 以外的内容：
{
  "trend": "Uptrend|Sideways|Downtrend|Breakout Watch|Breakdown Risk",
  "ma20": number_or_null,
  "ma50": number_or_null,
  "ma200": number_or_null,
  "price_vs_ma200_pct": number_or_null,
  "rsi": number_or_null,
  "rsi_signal": "Overbought|Neutral|Oversold",
  "macd_signal": "Bullish|Neutral|Bearish",
  "volume_alert": boolean,
  "volume_ratio": number_or_null,
  "support_level": number_or_null,
  "resistance_level": number_or_null,
  "technical_conclusion": "string",
  "risk_flags": ["string"],
  "overall_risk": "Low|Medium|High|Speculative",
  "risk_summary": "string（100字内中文）"
}`

export async function runTechnicalRiskAgent(
  overview: StockOverview,
  technicals: TechnicalIndicators
): Promise<TechnicalRiskResult> {
  const userMsg = JSON.stringify({
    ticker: overview.ticker,
    company: overview.company_name,
    current_price: overview.price,
    pe_ratio: overview.pe_ratio,
    pb_ratio: overview.pb_ratio,
    beta: overview.beta,
    technicals,
  }, null, 0)

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  })

  const text = (msg.content[0] as { text: string }).text.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Technical agent returned no JSON")
  return JSON.parse(jsonMatch[0]) as TechnicalRiskResult
}
