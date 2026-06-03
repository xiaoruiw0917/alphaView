"use client"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"

interface Suggestion {
  ticker: string
  name: string
  sector: string
}

export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const [query, setQuery] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleChange(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!v.trim()) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(v)}`)
        const data = await res.json() as Suggestion[]
        setSuggestions(data)
        setOpen(true)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }, 200)
  }

  function navigate(ticker: string) {
    setOpen(false)
    setQuery(ticker)
    router.push(`/stock/${ticker.toUpperCase()}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) navigate(query.trim().toUpperCase())
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            onFocus={() => query && setOpen(true)}
            onKeyDown={handleKey}
            placeholder="输入股票代码：NVDA、AAPL、TSLA..."
            className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-sm font-mono tracking-wide transition-all"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="submit"
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors whitespace-nowrap"
        >
          分析
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--border)] bg-[#0f1623] shadow-2xl overflow-hidden z-50">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => navigate(s.ticker)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--card)] text-left transition-colors border-b border-[var(--border)] last:border-0"
            >
              <span className="font-mono font-bold text-blue-400 text-sm w-16 shrink-0">{s.ticker}</span>
              <span className="text-sm text-white truncate flex-1">{s.name}</span>
              {s.sector && <span className="text-xs text-gray-500 shrink-0">{s.sector}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
