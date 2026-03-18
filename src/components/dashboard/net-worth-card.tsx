import { Card, CardContent } from "@/components/ui/card"
import { AmountDisplay } from "@/components/shared/amount-display"

interface NetWorthCardProps {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
}

export function NetWorthCard({ netWorth, totalAssets, totalLiabilities }: NetWorthCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">净资产</div>
          <AmountDisplay cents={netWorth} size="lg" colorize />
        </div>
        <div className="flex justify-around mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">总资产</div>
            <AmountDisplay cents={totalAssets} size="sm" className="text-emerald-600" />
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">总负债</div>
            <AmountDisplay cents={totalLiabilities} size="sm" className="text-red-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
