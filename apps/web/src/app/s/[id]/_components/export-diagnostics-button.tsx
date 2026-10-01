"use client"

import { Button } from "@crikket/ui/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { client } from "@/utils/orpc"

export function ExportDiagnosticsButton({ reportId }: { reportId: string }) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (isExporting) {
      return
    }

    setIsExporting(true)

    try {
      const diagnostics = await client.bugReport.exportDiagnostics({
        id: reportId,
      })

      const json = JSON.stringify(diagnostics, null, 2)
      const blob = new Blob([json], {
        type: "application/json;charset=utf-8",
      })

      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")

      try {
        link.href = downloadUrl
        link.download = `crikket-${encodeURIComponent(reportId)}-diagnostics.json`

        document.body.appendChild(link)
        link.click()
      } finally {
        link.remove()

        window.setTimeout(() => {
          URL.revokeObjectURL(downloadUrl)
        }, 1000)
      }

      toast.success("Diagnostics download started")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export diagnostics"
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      aria-label={isExporting ? "Exporting diagnostics" : "Export JSON"}
      disabled={isExporting}
      onClick={handleExport}
      size="sm"
      type="button"
      variant="outline"
    >
      {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
      <span className="hidden sm:inline">
        {isExporting ? "Exporting..." : "Export JSON"}
      </span>
    </Button>
  )
}
