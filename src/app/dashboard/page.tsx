"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { NetWorthCard } from "@/components/dashboard/net-worth-card"
import { AssetSummary } from "@/components/dashboard/asset-summary"
import { LiabilitySummary } from "@/components/dashboard/liability-summary"
import { useBalanceSheet } from "@/lib/hooks/use-balance-sheet"
import { useAccounts } from "@/lib/hooks/use-accounts"

export default function DashboardPage() {
  const { assetTree, liabilityTree, totalAssets, totalLiabilities, netWorth } = useBalanceSheet()
  const accounts = useAccounts()
  const hasAccounts = accounts.length > 0

  return (
    <div>
      <PageHeader title="总览" />
      <div className="p-4 space-y-4">
        <NetWorthCard
          netWorth={netWorth}
          totalAssets={totalAssets}
          totalLiabilities={totalLiabilities}
        />

        {hasAccounts ? (
          <>
            <AssetSummary tree={assetTree} total={totalAssets} />
            <LiabilitySummary tree={liabilityTree} total={totalLiabilities} />
          </>
        ) : (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground text-sm">
              还没有任何账户，开始创建你的第一个账户吧
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/accounts/new">
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  创建账户
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
