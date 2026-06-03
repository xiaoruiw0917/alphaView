import { NextRequest, NextResponse } from "next/server"
import { fetchHistory } from "@/lib/services/stockDataService"
import { computeTechnicals } from "@/lib/services/technicalService"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const period = req.nextUrl.searchParams.get("period") || "1y"
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  try {
    const bars = await fetchHistory(ticker.toUpperCase(), period)
    const technicals = computeTechnicals(bars)
    return NextResponse.json({ bars, technicals }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
