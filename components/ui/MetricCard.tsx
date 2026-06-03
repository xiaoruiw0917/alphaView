"use client"
import clsx from "clsx"

interface MetricCardProps {
  label: string
  value: string | number | null
  sub?: string
  color?: "green" | "red" | "yellow" | "blue" | "default"
  size?: "sm" | "md"
}

export function MetricCard({ label, value, sub, color = "default", size = "md" }: MetricCardProps) {
  const colorMap = {
    green: "text-emerald-400",
    red: "text-red-400",
    yellow: "text-amber-400",
    blue: "text-blue-400",
    default: "text-white",
  }

  return (
    <div className={clsx(
      "rounded-lg border p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-500/50",
      "border-[var(--border)] bg-[var(--card)]"
    )}>
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <p className={clsx(
        "font-semibold tabular-nums",
        size === "sm" ? "text-base" : "text-xl",
        colorMap[color],
        value === null || value === undefined ? "text-gray-600" : ""
      )}>
        {value === null || value === undefined ? "—" : value}
      </p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}
