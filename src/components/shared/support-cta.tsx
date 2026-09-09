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
      toast.success("Donation address copied")
    } catch {
      toast.error("Could not copy. Copy the address manually.")
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-3">
        <div>
          <div className="text-sm font-medium flex items-center justify-center gap-1.5">
            <Coffee className="h-4 w-4" />
            Buy the author a coffee
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Free · Open source · No ads · Your data stays on your device
          </div>
        </div>
        <div className="text-xs text-muted-foreground font-mono break-all px-2">
          {DONATION_ADDRESS}
        </div>
        <Button onClick={handleCopy} variant="outline">
          <Copy className="h-4 w-4 mr-1.5" />
          Copy donation address
        </Button>
        <div className="text-xs text-muted-foreground">
          EVM address · ETH / USDT / USDC on Ethereum, Base, Arbitrum, and other EVM networks
        </div>
      </CardContent>
    </Card>
  )
}
