"use client"

import { useRef, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { formatAmount, parseToCents } from "@/lib/utils/format"
import { getCurrencySymbol } from "@/lib/utils/constants"
import { cn } from "@/lib/utils"
import {
  evaluateAmountExpression,
  isAllowedExpressionInput,
  type AmountInputStatus,
} from "@/lib/utils/amount-expression"

export type { AmountInputStatus } from "@/lib/utils/amount-expression"

/**
 * Add thousands separators to a numeric string, preserving decimal part.
 * "20000" -> "20,000"
 * "20000.5" -> "20,000.5"
 * "" -> ""
 */
function addThousandsSep(value: string): string {
  if (!value) return ""
  const [intPart, decPart] = value.split(".")
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted
}

/**
 * Strip commas from display string.
 */
function stripCommas(value: string): string {
  return value.replace(/,/g, "")
}

function formatInitial(cents: number): string {
  if (cents === 0) return ""
  const yuan = (cents / 100).toFixed(2)
  return addThousandsSep(yuan)
}

interface AmountInputProps {
  value: number // cents
  onChange: (cents: number) => void
  placeholder?: string
  className?: string
  currency?: string
  enableExpression?: boolean
  onStatusChange?: (status: AmountInputStatus) => void
}

export function AmountInput({
  value,
  onChange,
  placeholder = "0.00",
  className,
  currency = "CNY",
  enableExpression = false,
  onStatusChange,
}: AmountInputProps) {
  const [display, setDisplay] = useState(() => formatInitial(value))
  const inputRef = useRef<HTMLInputElement>(null)
  const symbol = getCurrencySymbol(currency)
  const isWide = symbol.length > 1 // HK$ etc.
  const expressionStatus = enableExpression ? evaluateAmountExpression(display) : null
  const preview = expressionStatus?.hasResult ? `= ${formatAmount(expressionStatus.cents, currency)}` : ""

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target
      const cursorPos = el.selectionStart ?? 0

      if (enableExpression) {
        if (!isAllowedExpressionInput(el.value)) {
          return
        }

        const status = evaluateAmountExpression(el.value)
        setDisplay(el.value)
        onStatusChange?.(status)
        onChange(status.hasResult ? status.cents : 0)
        return
      }

      // Strip commas to get raw number
      const raw = stripCommas(el.value)

      // Validate: allow empty, digits, one dot, up to 2 decimal places
      if (raw !== "" && !/^\d*\.?\d{0,2}$/.test(raw)) {
        return
      }

      // Format with thousands separator
      const formatted = addThousandsSep(raw)
      setDisplay(formatted)

      // Update cents value
      const cents = parseToCents(raw)
      onChange(cents)

      // Restore cursor position, adjusting for added/removed commas
      const commasBefore = el.value.slice(0, cursorPos).split(",").length - 1
      const rawPos = cursorPos - commasBefore
      let newPos = 0
      let rawCount = 0
      for (let i = 0; i < formatted.length; i++) {
        if (rawCount >= rawPos) break
        newPos++
        if (formatted[i] !== ",") rawCount++
      }
      requestAnimationFrame(() => {
        if (!inputRef.current) return
        inputRef.current.setSelectionRange(newPos, newPos)
      })
    },
    [enableExpression, onChange, onStatusChange]
  )

  const handleBlur = useCallback(() => {
    if (enableExpression) {
      return
    }

    if (display === "" || display === ".") {
      setDisplay("")
      onChange(0)
      return
    }
    // Normalize: ensure trailing .00
    const raw = stripCommas(display)
    const cents = parseToCents(raw)
    setDisplay(formatInitial(cents))
  }, [display, enableExpression, onChange])

  return (
    <div className={cn(enableExpression && "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2")}>
      <div className="relative min-w-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          {symbol}
        </span>
        <Input
          ref={inputRef}
          type="text"
          inputMode={enableExpression ? "text" : "decimal"}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(isWide ? "pl-11" : "pl-7", className)}
        />
      </div>
      {enableExpression && (
        <div
          className={cn(
            "flex h-9 min-w-24 max-w-36 items-center justify-end truncate text-sm tabular-nums",
            expressionStatus?.hasResult && !expressionStatus.isValid
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {preview}
        </div>
      )}
    </div>
  )
}
