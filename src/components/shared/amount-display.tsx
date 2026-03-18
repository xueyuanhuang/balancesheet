import { formatAmount } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface AmountDisplayProps {
  cents: number
  className?: string
  colorize?: boolean // true = green for positive, red for negative
  size?: "sm" | "md" | "lg"
  currency?: string
}

export function AmountDisplay({ cents, className, colorize = false, size = "md", currency = "CNY" }: AmountDisplayProps) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl font-bold",
  }

  return (
    <span
      className={cn(
        sizeClasses[size],
        "tabular-nums",
        colorize && cents > 0 && "text-emerald-600",
        colorize && cents < 0 && "text-red-500",
        className
      )}
    >
      {formatAmount(cents, currency)}
    </span>
  )
}
