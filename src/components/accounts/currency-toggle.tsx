"use client"

import { cn } from "@/lib/utils"
import type { CurrencyDisplayMode } from "@/lib/hooks/use-currency-display"

const OPTIONS: { value: CurrencyDisplayMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "CNY", label: "¥" },
  { value: "USD", label: "$" },
  { value: "HKD", label: "HK$" },
]

interface CurrencyToggleProps {
  value: CurrencyDisplayMode
  onChange: (mode: CurrencyDisplayMode) => void
}

export function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  return (
    <div className="inline-flex items-center rounded-md border bg-muted p-0.5 text-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={cn(
            "px-1.5 py-0.5 rounded-sm transition-colors font-medium",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
