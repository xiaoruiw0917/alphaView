import clsx from "clsx"

type BadgeVariant = "green" | "red" | "yellow" | "blue" | "purple" | "gray"

interface BadgeProps {
  label: string
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
  yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  gray: "bg-gray-700/50 text-gray-400 border-gray-600/30",
}

export function Badge({ label, variant = "gray" }: BadgeProps) {
  return (
    <span className={clsx(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
      variantStyles[variant]
    )}>
      {label}
    </span>
  )
}

export function conclusionVariant(c: string): BadgeVariant {
  if (c.includes("Undervalued") || c.includes("Compounder")) return "green"
  if (c.includes("Expensive") || c.includes("Overheated") || c.includes("High Risk")) return "red"
  if (c.includes("Watching") || c.includes("Catalyst")) return "blue"
  if (c.includes("Weak")) return "red"
  if (c.includes("Growth")) return "yellow"
  return "gray"
}

export function riskVariant(r: string): BadgeVariant {
  if (r === "Low") return "green"
  if (r === "Medium") return "yellow"
  if (r === "High") return "red"
  if (r === "Speculative") return "purple"
  return "gray"
}

export function trendVariant(t: string): BadgeVariant {
  if (t === "Uptrend" || t === "Breakout Watch") return "green"
  if (t === "Downtrend" || t === "Breakdown Risk") return "red"
  if (t === "Sideways") return "yellow"
  return "gray"
}
