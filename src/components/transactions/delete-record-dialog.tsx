"use client"

import { useEffect, useState } from "react"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { activityService, type ActivityDeletePreview, type ActivityDeleteTarget } from "@/lib/services/activity-service"
import { toast } from "sonner"

interface DeleteRecordDialogProps {
  target: ActivityDeleteTarget | null
  onClose: () => void
  onDeleted?: (result: { deletedAccountIds: string[] }) => void
}

export function DeleteRecordDialog({ target, onClose, onDeleted }: DeleteRecordDialogProps) {
  if (!target) return null
  return <OpenDeleteRecordDialog key={`${target.type}:${target.id}`} target={target} onClose={onClose} onDeleted={onDeleted} />
}

function OpenDeleteRecordDialog({ target, onClose, onDeleted }: DeleteRecordDialogProps & { target: ActivityDeleteTarget }) {
  const [preview, setPreview] = useState<ActivityDeletePreview | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { type, id } = target

  useEffect(() => {
    let cancelled = false
    activityService.getDeletePreview({ type, id }).then((result) => {
      if (!cancelled) setPreview(result)
    }).catch((error) => {
      if (cancelled) return
      toast.error(error instanceof Error ? error.message : "Could not load record")
      onClose()
    })
    return () => { cancelled = true }
  }, [type, id, onClose])

  const currentPreview = preview?.target.type === type && preview.target.id === id ? preview : null

  const confirmDelete = async () => {
    if (!currentPreview || deleting) return
    setDeleting(true)
    try {
      const result = await activityService.deleteRecord(currentPreview)
      toast.success("Record deleted")
      onClose()
      onDeleted?.(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete record")
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open && !deleting) onClose() }}
      title={currentPreview?.title ?? "Delete record"}
      description={currentPreview?.description ?? "Loading record..."}
      confirmLabel={currentPreview?.confirmLabel ?? "Delete"}
      variant="destructive"
      loading={deleting || !currentPreview}
      onConfirm={confirmDelete}
    />
  )
}
