import clsx from "clsx"
import type { ReactNode } from "react"

interface SectionCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function SectionCard({ title, subtitle, children, className, action }: SectionCardProps) {
  return (
    <div className={clsx(
      "rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden",
      className
    )}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-wide">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
