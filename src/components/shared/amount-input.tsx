"use client"

import { useRef, useState, useCallback, useId } from "react"
import { Calculator } from "lucide-react"
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
  allowNegative?: boolean
  onCommit?: (cents: number) => void
  ariaLabel?: string
  onStatusChange?: (status: AmountInputStatus) => void
}

export function AmountInput({
  value,
  onChange,
  placeholder = "0.00",
  className,
  currency = "CNY",
  enableExpression = false,
  allowNegative = false,
  onCommit,
  ariaLabel = "Amount",
  onStatusChange,
}: AmountInputProps) {
  const [draft, setDraft] = useState(() => ({ value, display: formatInitial(value) }))
  const [showOperators, setShowOperators] = useState(false)
  const operatorsId = useId()
  // Preserve the expression while typing, but follow external changes such
  // as a direction switch or swapping the two transfer amounts.
  if (draft.value !== value) {
    setDraft({ value, display: formatInitial(value) })
  }
  const display = draft.value === value ? draft.display : formatInitial(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const symbol = getCurrencySymbol(currency)
  const isWide = symbol.length > 1 // HK$ etc.
  const expressionStatus = enableExpression ? evaluateAmountExpression(display, allowNegative) : null
  const preview = expressionStatus?.hasResult ? `= ${formatAmount(expressionStatus.cents, currency)}` : ""

  const updateExpression = useCallback((text: string) => {
    if (!isAllowedExpressionInput(text)) return
    const status = evaluateAmountExpression(text, allowNegative)
    const cents = status.hasResult ? status.cents : 0
    setDraft({ value: cents, display: text })
    onStatusChange?.(status)
    onChange(cents)
  }, [allowNegative, onChange, onStatusChange])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target
      const cursorPos = el.selectionStart ?? 0

      if (enableExpression) {
        updateExpression(el.value)
        return
      }

      // Strip commas to get raw number
      const raw = stripCommas(el.value)

      // Validate: allow empty, digits, one dot, up to 2 decimal places
      const numberPattern = allowNegative ? /^-?\d*\.?\d{0,2}$/ : /^\d*\.?\d{0,2}$/
      if (raw !== "" && !numberPattern.test(raw)) {
        return
      }

      // Format with thousands separator
      const formatted = addThousandsSep(raw)

      // Update cents value
      const cents = parseToCents(raw)
      setDraft({ value: cents, display: formatted })
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
    [enableExpression, allowNegative, onChange, updateExpression]
  )

  const insertOperator = (operator: string) => {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart ?? display.length
    const end = input.selectionEnd ?? start
    updateExpression(display.slice(0, start) + operator + display.slice(end))
    // Focus synchronously with the tap so iOS keeps its decimal keyboard open.
    input.focus({ preventScroll: true })
    requestAnimationFrame(() => input.setSelectionRange(start + operator.length, start + operator.length))
  }

  const handleBlur = useCallback(() => {
    if (enableExpression) {
      const status = evaluateAmountExpression(display, allowNegative)
      if (status.isValid) onCommit?.(status.cents)
      return
    }

    if (display === "" || display === "." || display === "-" || display === "-.") {
      setDraft({ value: 0, display: "" })
      onChange(0)
      return
    }
    // Normalize: ensure trailing .00
    const raw = stripCommas(display)
    const cents = parseToCents(raw)
    setDraft({ value: cents, display: formatInitial(cents) })
  }, [display, enableExpression, allowNegative, onCommit, onChange])

  return (
    <div
      className={cn(enableExpression && "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2")}
      onBlur={(event) => {
        // Moving to a calculation button must not commit a negative expression
        // (and reverse the transaction) while the user is still editing it.
        if (event.currentTarget.contains(event.relatedTarget)) return
        handleBlur()
      }}
    >
      <div className="relative min-w-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          {symbol}
        </span>
        <Input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={cn(isWide ? "pl-11" : "pl-7", enableExpression && "h-11 pr-12", className)}
        />
        {enableExpression && (
          <button
            type="button"
            aria-label={`${showOperators ? "Hide" : "Show"} calculation buttons for ${ariaLabel.toLowerCase()}`}
            aria-expanded={showOperators}
            aria-controls={operatorsId}
            title="Calculation buttons"
            className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:text-foreground"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              setShowOperators((shown) => !shown)
              inputRef.current?.focus({ preventScroll: true })
            }}
          >
            <Calculator className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {enableExpression && (
        <div
          className={cn(
            "flex h-11 min-w-24 max-w-36 items-center justify-end truncate text-sm tabular-nums",
            expressionStatus?.hasResult && !expressionStatus.isValid
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {preview}
        </div>
      )}
      {enableExpression && (
        <div
          id={operatorsId}
          role="group"
          aria-label={`${ariaLabel} calculation buttons`}
          hidden={!showOperators}
          className={cn("col-span-2 gap-1", showOperators ? "flex" : "hidden")}
        >
          {[
            ["+", "Add"], ["−", "Subtract or enter a negative amount"],
            ["×", "Multiply"], ["÷", "Divide"],
            ["(", "Open parenthesis"], [")", "Close parenthesis"],
          ].map(([operator, label]) => (
            <button
              key={operator}
              type="button"
              aria-label={`${ariaLabel}: ${label}`}
              className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-muted/50 text-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => insertOperator(operator)}
            >
              {operator}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
