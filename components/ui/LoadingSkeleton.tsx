export function LoadingSkeleton({ rows = 4, height = "h-4" }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} bg-gray-800 rounded-md`} style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  )
}

export function MetricGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 animate-pulse">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="h-20 bg-[var(--card)] border border-[var(--border)] rounded-lg" />
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="h-80 bg-[var(--card)] rounded-lg animate-pulse flex items-center justify-center border border-[var(--border)]">
      <div className="text-[var(--text-muted)] text-sm">图表加载中...</div>
    </div>
  )
}
