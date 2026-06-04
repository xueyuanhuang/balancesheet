export interface AmountInputStatus {
  raw: string
  cents: number
  hasInput: boolean
  hasResult: boolean
  isValid: boolean
  error: string | null
}

export function normalizeExpression(value: string): string {
  return value
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - "０".charCodeAt(0)))
    .replace(/[，]/g, ",")
    .replace(/[。]/g, ".")
    .replace(/[＋]/g, "+")
    .replace(/[－−]/g, "-")
    .replace(/[＊×]/g, "*")
    .replace(/[／÷]/g, "/")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/,/g, "")
    .replace(/\s/g, "")
}

export function isAllowedExpressionInput(value: string): boolean {
  return /^[\d０-９+\-－−*＊×/／÷().（）\s,.，。]*$/.test(value)
}

class IncompleteExpressionError extends Error {}
class InvalidExpressionError extends Error {}
class DivideByZeroError extends Error {}

class ExpressionParser {
  private pos = 0

  constructor(private readonly input: string) {}

  parse(): number {
    const value = this.parseExpression()
    if (this.pos < this.input.length) {
      throw new InvalidExpressionError()
    }
    return value
  }

  private parseExpression(): number {
    let value = this.parseTerm()

    while (this.peek() === "+" || this.peek() === "-") {
      const operator = this.consume()
      const next = this.parseTerm()
      value = operator === "+" ? value + next : value - next
    }

    return value
  }

  private parseTerm(): number {
    let value = this.parseFactor()

    while (this.peek() === "*" || this.peek() === "/") {
      const operator = this.consume()
      const next = this.parseFactor()

      if (operator === "/" && next === 0) {
        throw new DivideByZeroError()
      }

      value = operator === "*" ? value * next : value / next
    }

    return value
  }

  private parseFactor(): number {
    const char = this.peek()

    if (!char) {
      throw new IncompleteExpressionError()
    }

    if (char === "+") {
      this.consume()
      return this.parseFactor()
    }

    if (char === "-") {
      this.consume()
      return -this.parseFactor()
    }

    if (char === "(") {
      this.consume()
      const value = this.parseExpression()
      if (this.peek() !== ")") {
        throw new IncompleteExpressionError()
      }
      this.consume()
      return value
    }

    return this.parseNumber()
  }

  private parseNumber(): number {
    const start = this.pos

    while (/\d/.test(this.peek() ?? "")) {
      this.consume()
    }

    if (this.peek() === ".") {
      this.consume()
      while (/\d/.test(this.peek() ?? "")) {
        this.consume()
      }
    }

    const token = this.input.slice(start, this.pos)

    if (!token || token === ".") {
      if (!this.peek()) {
        throw new IncompleteExpressionError()
      }
      throw new InvalidExpressionError()
    }

    const value = Number(token)
    if (!Number.isFinite(value)) {
      throw new InvalidExpressionError()
    }

    return value
  }

  private peek(): string | undefined {
    return this.input[this.pos]
  }

  private consume(): string {
    return this.input[this.pos++]
  }
}

export function evaluateAmountExpression(raw: string): AmountInputStatus {
  if (!raw.trim()) {
    return {
      raw,
      cents: 0,
      hasInput: false,
      hasResult: false,
      isValid: false,
      error: null,
    }
  }

  const normalized = normalizeExpression(raw)

  if (!normalized) {
    return {
      raw,
      cents: 0,
      hasInput: true,
      hasResult: false,
      isValid: false,
      error: "算式不完整",
    }
  }

  try {
    const result = new ExpressionParser(normalized).parse()
    const cents = Math.round(result * 100)

    return {
      raw,
      cents,
      hasInput: true,
      hasResult: true,
      isValid: cents > 0,
      error: cents > 0 ? null : "必须大于 0",
    }
  } catch (error) {
    const message =
      error instanceof DivideByZeroError
        ? "不能除以 0"
        : error instanceof IncompleteExpressionError
          ? "算式不完整"
          : "算式格式不正确"

    return {
      raw,
      cents: 0,
      hasInput: true,
      hasResult: false,
      isValid: false,
      error: message,
    }
  }
}
