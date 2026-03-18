"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FolderTree, Plus, Sparkles } from "lucide-react"
import { seedDefaultCategories, markInitialized } from "@/lib/db/seed"

interface OnboardingProps {
  onComplete: () => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [loading, setLoading] = useState(false)

  const handleUseDefaults = async () => {
    setLoading(true)
    await seedDefaultCategories()
    onComplete()
  }

  const handleStartBlank = () => {
    markInitialized()
    onComplete()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">个人资产负债表</h1>
          <p className="text-sm text-muted-foreground">
            清晰管理你的资产、负债和净资产
          </p>
        </div>

        <div className="space-y-3">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={handleUseDefaults}
          >
            <CardContent className="flex items-start gap-3 pt-5 pb-5">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium">使用推荐分类</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  预设常见的资产和负债分类（现金存款、投资、房产、信用卡、贷款等），可随时修改
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={handleStartBlank}
          >
            <CardContent className="flex items-start gap-3 pt-5 pb-5">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium">从空白开始</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  完全自定义，按你自己的方式创建分类
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading && (
          <div className="text-center text-sm text-muted-foreground">初始化中...</div>
        )}
      </div>
    </div>
  )
}
