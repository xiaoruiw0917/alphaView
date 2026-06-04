import { NextRequest, NextResponse } from "next/server"
import { fetchFinancialsAndPeers } from "@/lib/services/stockDataService"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  try {
    const { annual, peers } = await fetchFinancialsAndPeers(ticker.toUpperCase())
    return NextResponse.json(
      { financials: { annual }, peers },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" } }
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
