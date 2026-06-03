import Anthropic from "@anthropic-ai/sdk"
import type { HotStock } from "@/lib/types/stock"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是美股新闻情报与热点筛选分析师。你已收到最近 24 小时的市场新闻摘要列表。

你的任务：
1. 识别当天最值得关注的 5-8 个市场主题（AI算力、半导体、能源、生物医药、网络安全等）
2. 每个主题推荐 1-2 只直接受益的美股（只限 NYSE/NASDAQ/AMEX，市值 > 10 亿美元，排除 OTC、粉单）
3. 说明每只股票的受益逻辑和产业链位置（Upstream/Midstream/Downstream/Platform）
4. 计算 Hot Score（0-100）按以下权重：
   - news_heat: 0-30（新闻数量和热度）
   - credibility: 0-15（来源可信度：Reuters/Bloomberg/WSJ > 0.9 高分）
   - policy: 0-15（政策支持力度）
   - growth: 0-15（行业长期成长性）
   - financial: 0-10（财务质量估计，无数据时给中值）
   - valuation: 0-10（估值合理性估计）
   - technical: 0-5（技术面动量估计）

结论只能使用：Worth Watching | High Momentum High Risk | Policy Beneficiary | Structural Growth | Short-term Catalyst
风险级别：Low | Medium | High | Speculative

禁止推荐 A股、港股、OTC、粉单股票。
必须输出合法 JSON 数组，不要输出任何 JSON 以外的内容：
[{
  "theme": "string",
  "theme_heat": number,
  "ticker": "string",
  "company_name": "string",
  "exchange": "NYSE|NASDAQ|AMEX",
  "supply_chain_position": "Upstream|Midstream|Downstream|Platform",
  "benefit_logic": "string（100字内）",
  "hot_score": number,
  "score_breakdown": {"news_heat": number, "credibility": number, "policy": number, "growth": number, "financial": number, "valuation": number, "technical": number},
  "risk_level": "Low|Medium|High|Speculative",
  "key_news": ["string"],
  "conclusion": "string"
}]`

export async function runNewsHotStockAgent(
  newsItems: Array<{ title: string; source: string; summary: string; published_at: string }>
): Promise<HotStock[]> {
  const userMsg = JSON.stringify({
    news_count: newsItems.length,
    news: newsItems.slice(0, 30).map(n => ({
      title: n.title,
      source: n.source,
      summary: n.summary.slice(0, 200),
      published_at: n.published_at,
    })),
  }, null, 0)

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  })

  const text = (msg.content[0] as { text: string }).text.trim()
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error("Hot stock agent returned no JSON array")
  return JSON.parse(jsonMatch[0]) as HotStock[]
}
