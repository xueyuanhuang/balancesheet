"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { exchangeRateService } from "@/lib/services/exchange-rate-service"
import { useExchangeRates } from "@/lib/hooks/use-exchange-rates"
import { toast } from "sonner"

export default function ExchangeRatesPage() {
  const [refreshing, setRefreshing] = useState(false)
  const exchangeRates = useExchangeRates()

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await exchangeRateService.fetchRates()
      toast.success("Exchange rates updated")
    } catch {
      toast.error("Could not update rates. Check your connection.")
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Exchange rates"
        showBack
        rightAction={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh exchange rates"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        }
      />
      <div className="p-4 space-y-1">
        {exchangeRates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No exchange rates yet. Tap Refresh to load them.
          </p>
        ) : (
          exchangeRates.map((r) => (
            <div
              key={r.currency}
              className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/30"
            >
              <span className="text-sm font-medium">1 {r.currency}</span>
              <div className="text-right">
                <span className="text-sm tabular-nums">= ¥{r.rateToCNY.toFixed(4)}</span>
                <span className="text-xs text-muted-foreground ml-3">
                  {new Date(r.updatedAt).toLocaleDateString("en-US")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
