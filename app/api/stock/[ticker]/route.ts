import { NextRequest, NextResponse } from "next/server"
import { fetchOverview } from "@/lib/services/stockDataService"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })

  try {
    const data = await fetchOverview(ticker.toUpperCase())
    const anyData = data as unknown as { error?: string }
    if (anyData.error) {
      return NextResponse.json({ error: anyData.error }, { status: 404 })
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
