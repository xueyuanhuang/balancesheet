"use client"

import { Coffee, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

const DONATION_ADDRESS = "0x9f14F10E511b2772cc63E5667a012cEA09CECf86"

export function SupportCTA() {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DONATION_ADDRESS)
      toast.success("打赏地址已复制")
    } catch {
      toast.error("复制失败，请手动复制地址")
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-3">
        <div>
          <div className="text-sm font-medium flex items-center justify-center gap-1.5">
            <Coffee className="h-4 w-4" />
            请作者喝杯咖啡
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            完全免费 · 开源 · 无广告 · 数据不离开你的设备
          </div>
        </div>
        <div className="text-xs text-muted-foreground font-mono break-all px-2">
          {DONATION_ADDRESS}
        </div>
        <Button onClick={handleCopy} variant="outline">
          <Copy className="h-4 w-4 mr-1.5" />
          复制打赏地址
        </Button>
        <div className="text-xs text-muted-foreground">
          EVM 地址 · 支持 ETH / USDT / USDC（以太坊、Base、Arbitrum 等主流链）
        </div>
      </CardContent>
    </Card>
  )
}
