"use client"

import { useRef, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { parseToCents } from "@/lib/utils/format"
import { getCurrencySymbol } from "@/lib/utils/constants"

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
}

export function AmountInput({ value, onChange, placeholder = "0.00", className, currency = "CNY" }: AmountInputProps) {
  const [display, setDisplay] = useState(() => formatInitial(value))
  const inputRef = useRef<HTMLInputElement>(null)
  const symbol = getCurrencySymbol(currency)
  const isWide = symbol.length > 1 // HK$ etc.

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target
      const cursorPos = el.selectionStart ?? 0

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
    [onChange]
  )

  const handleBlur = useCallback(() => {
    if (display === "" || display === ".") {
      setDisplay("")
      onChange(0)
      return
    }
    // Normalize: ensure trailing .00
    const raw = stripCommas(display)
    const cents = parseToCents(raw)
    setDisplay(formatInitial(cents))
  }, [display, onChange])

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        {symbol}
      </span>
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`${isWide ? "pl-11" : "pl-7"} ${className ?? ""}`}
      />
    </div>
  )
}
