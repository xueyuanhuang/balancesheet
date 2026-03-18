"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Wallet, Plus, ArrowLeftRight, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { href: "/dashboard", label: "总览", icon: LayoutDashboard },
  { href: "/accounts", label: "账户", icon: Wallet },
  { href: "/transactions", label: "流水", icon: ArrowLeftRight },
  { href: "/settings", label: "设置", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab, index) => {
          const isActive = pathname.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Fragment key={tab.href}>
              {index === 2 && (
                <Link
                  href="/transactions/new"
                  className="flex -mt-6 h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
                >
                  <Plus className="h-7 w-7" />
                </Link>
              )}
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[4rem] py-1",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] leading-tight">{tab.label}</span>
              </Link>
            </Fragment>
          )
        })}
      </div>
    </nav>
  )
}
