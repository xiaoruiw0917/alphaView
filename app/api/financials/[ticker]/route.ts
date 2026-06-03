import { NextRequest, NextResponse } from "next/server"
import { fetchFinancials, fetchPeers } from "@/lib/services/stockDataService"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  try {
    const [financials, peers] = await Promise.all([
      fetchFinancials(ticker.toUpperCase()),
      fetchPeers(ticker.toUpperCase()),
    ])
    return NextResponse.json({ financials, peers }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
