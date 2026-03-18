"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { AccountList } from "@/components/accounts/account-list"
import { CurrencyToggle } from "@/components/accounts/currency-toggle"
import { useCurrencyDisplayMode } from "@/lib/hooks/use-currency-display"

export default function AccountsPage() {
  const [displayMode, setDisplayMode] = useCurrencyDisplayMode()

  return (
    <div>
      <PageHeader
        title="账户"
        rightAction={
          <div className="flex items-center gap-1">
            <CurrencyToggle value={displayMode} onChange={setDisplayMode} />
            <Link href="/accounts/new">
              <Button variant="ghost" size="icon">
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        }
      />
      <div className="py-4">
        <AccountList displayCurrency={displayMode} />
      </div>
    </div>
  )
}
