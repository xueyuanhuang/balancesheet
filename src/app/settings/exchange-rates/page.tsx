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
      toast.success("汇率已更新")
    } catch {
      toast.error("汇率更新失败，请检查网络")
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="汇率"
        showBack
        rightAction={
          <Button
            variant="ghost"
            size="icon"
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
            暂无汇率数据，点右上角刷新获取
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
                  {new Date(r.updatedAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
