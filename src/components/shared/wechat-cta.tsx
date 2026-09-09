"use client"

import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

export function WechatCTA() {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("_xueyuanhuang")
      toast.success("WeChat ID copied")
    } catch {
      toast.error("Could not copy. WeChat ID: _xueyuanhuang")
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-3">
        <div>
          <div className="text-sm font-medium">AI Workshop</div>
          <div className="text-xs text-muted-foreground mt-1">
            Explore AI-made tools, try new releases, and share your feedback.
          </div>
        </div>
        <Button
          onClick={handleCopy}
          className="bg-[#07C160] hover:bg-[#06AD56] text-white"
        >
          <MessageCircle className="h-4 w-4 mr-1.5" />
          Copy WeChat ID
        </Button>
        <div className="text-xs text-muted-foreground">
          Add the author on WeChat and ask to join the AI Workshop group.
        </div>
      </CardContent>
    </Card>
  )
}
