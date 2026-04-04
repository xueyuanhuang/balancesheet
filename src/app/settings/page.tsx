"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Download, Upload, FolderTree, AlertTriangle, Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/layout/page-header"
import { WechatCTA } from "@/components/shared/wechat-cta"
import { backupService } from "@/lib/services/backup-service"
import { resetAllData } from "@/lib/db/seed"
import { toast } from "sonner"

export default function SettingsPage() {
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportJSON = async () => {
    try {
      await backupService.exportJSON()
      toast.success("JSON 备份已下载")
    } catch {
      toast.error("导出失败")
    }
  }

  const handleExportCSV = async () => {
    try {
      await backupService.exportCSV()
      toast.success("CSV 已下载")
    } catch {
      toast.error("导出失败")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImportDialogOpen(true)
    }
    e.target.value = ""
  }

  const handleImport = async () => {
    if (!selectedFile) return
    setImporting(true)
    try {
      const result = await backupService.importJSON(selectedFile)
      toast.success(
        `导入成功：${result.categories} 个分类、${result.accounts} 个账户、${result.operations} 条操作`
      )
      setImportDialogOpen(false)
      setSelectedFile(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <PageHeader title="设置" />
      <div className="p-4 space-y-4">
        {/* Category management */}
        <Card>
          <CardContent className="pt-6">
            <Link href="/categories" className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <FolderTree className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">分类管理</span>
              </div>
              <span className="text-muted-foreground text-sm">&rarr;</span>
            </Link>
          </CardContent>
        </Card>

        {/* Exchange rates */}
        <Card>
          <CardContent className="pt-6">
            <Link href="/settings/exchange-rates" className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">汇率管理</span>
              </div>
              <span className="text-muted-foreground text-sm">&rarr;</span>
            </Link>
          </CardContent>
        </Card>

        {/* Data management */}
        <Card>
          <CardContent className="pt-6 space-y-1">
            <h3 className="text-sm font-medium mb-3">数据管理</h3>

            <button
              onClick={handleExportJSON}
              className="flex w-full items-center gap-3 py-3 hover:bg-accent/50 rounded-lg px-2 -mx-2"
            >
              <Download className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="text-sm">导出 JSON 备份</div>
                <div className="text-xs text-muted-foreground">完整数据备份，可用于恢复</div>
              </div>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex w-full items-center gap-3 py-3 hover:bg-accent/50 rounded-lg px-2 -mx-2"
            >
              <Download className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="text-sm">导出 CSV 流水</div>
                <div className="text-xs text-muted-foreground">交易流水表格，可用 Excel 打开</div>
              </div>
            </button>

            <Separator />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-3 py-3 hover:bg-accent/50 rounded-lg px-2 -mx-2"
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="text-sm">导入 JSON 备份</div>
                <div className="text-xs text-muted-foreground">将覆盖现有所有数据</div>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card>
          <CardContent className="pt-6">
            <button
              onClick={() => setResetDialogOpen(true)}
              className="flex w-full items-center gap-3 py-3 hover:bg-accent/50 rounded-lg px-2 -mx-2"
            >
              <Trash2 className="h-5 w-5 text-destructive" />
              <div className="text-left">
                <div className="text-sm text-destructive">重置所有数据</div>
                <div className="text-xs text-muted-foreground">清空所有分类、账户和流水，重新开始</div>
              </div>
            </button>
          </CardContent>
        </Card>

        {/* WeChat CTA */}
        <WechatCTA />

        {/* App info */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          净值 v0.3.0
        </div>
      </div>

      {/* Reset confirmation dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              重置所有数据
            </DialogTitle>
            <DialogDescription>
              这将清除所有分类、账户和流水记录，App 将回到初始状态。此操作不可撤销，建议先导出备份。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={resetting}
              onClick={async () => {
                setResetting(true)
                try {
                  await resetAllData()
                  toast.success("已重置，即将重新加载...")
                  setTimeout(() => window.location.reload(), 500)
                } catch {
                  toast.error("重置失败")
                  setResetting(false)
                }
              }}
            >
              {resetting ? "重置中..." : "确认重置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import confirmation dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              确认导入
            </DialogTitle>
            <DialogDescription>
              导入将清除现有所有数据（分类、账户、流水），并用备份文件中的数据替换。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleImport} disabled={importing}>
              {importing ? "导入中..." : "确认导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
