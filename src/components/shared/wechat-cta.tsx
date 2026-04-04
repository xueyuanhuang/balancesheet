"use client"

import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

export function WechatCTA() {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText("_xueyuanhuang")
      toast.success("微信号已复制")
    } catch {
      toast.error("复制失败，微信号：_xueyuanhuang")
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 text-center space-y-3">
        <div>
          <div className="text-sm font-medium">AI 小作坊</div>
          <div className="text-xs text-muted-foreground mt-1">
            用 AI 做的小工具都在这 · 新品尝鲜 · 反馈直达 · 一起共创
          </div>
        </div>
        <Button
          onClick={handleCopy}
          className="bg-[#07C160] hover:bg-[#06AD56] text-white"
        >
          <MessageCircle className="h-4 w-4 mr-1.5" />
          复制微信号
        </Button>
        <div className="text-xs text-muted-foreground">
          添加后备注「小作坊」拉你进群
        </div>
      </CardContent>
    </Card>
  )
}
