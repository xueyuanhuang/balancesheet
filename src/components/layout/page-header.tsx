"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PageHeaderProps {
  title: string
  showBack?: boolean
  rightAction?: React.ReactNode
}

export function PageHeader({ title, showBack = false, rightAction }: PageHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background px-4 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {showBack && (
          <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => router.back()}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </div>
      {rightAction && <div className="shrink-0 ml-2">{rightAction}</div>}
    </header>
  )
}
