import { env } from "@crikket/env/extension"
import type { Priority } from "@crikket/shared/constants/priorities"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { AlertCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { FormStep } from "@/components/form-step"
import { IdleStep } from "@/components/idle-step"
import { RecordingStep } from "@/components/recording-step"
import { SuccessStep } from "@/components/success-step"
import { type CaptureType, useRecorderInit } from "@/hooks/use-recorder-init"
import { useScreenCapture } from "@/hooks/use-screen-capture"
import { useTimer } from "@/hooks/use-timer"
import { client } from "@/lib/orpc"
import { formatDuration, getDeviceInfo } from "@/lib/utils"

type State = "idle" | "recording" | "stopped" | "submitting" | "success"

function App() {
  const [state, setState] = useState<State>("idle")
  const [captureType, setCaptureType] = useState<CaptureType>("video")
  const [startTime, setStartTime] = useState<number | null>(null)

  const [resultUrl, setResultUrl] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [tabInfo, setTabInfo] = useState<{ title?: string; url?: string }>({})

  const {
    startRecording: startCapture,
    stopRecording: stopCapture,
    takeScreenshot: captureScreenshot,
    recordedBlob,
    screenshotBlob,
    error: captureError,
    reset: resetCapture,
    setScreenshotBlob,
  } = useScreenCapture()

  const duration = useTimer(startTime, state === "recording")

  const handleStartCapture = async () => {
    if (captureType === "screenshot") {
      const blob = await captureScreenshot()
      if (blob) {
        setState("stopped")
      }
    } else {
      const success = await startCapture()
      if (success) {
        setStartTime(Date.now())
        setState("recording")
      }
    }
  }

  useEffect(() => {
    if (state === "recording" && recordedBlob) {
      setState("stopped")
    }
  }, [state, recordedBlob])

  useEffect(() => {
    const readTabInfo = async () => {
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        const activeTab = tabs[0]
        setTabInfo({
          title: activeTab?.title ?? undefined,
          url: activeTab?.url ?? undefined,
        })
      } catch {
        setTabInfo({})
      }
    }

    readTabInfo()
  }, [])

  useRecorderInit({
    onCaptureTypeChange: setCaptureType,
    onScreenshotLoaded: (blob) => {
      setScreenshotBlob(blob)
      setState("stopped")
    },
    onStartRecording: handleStartCapture,
    onError: (err) => setSubmitError(err),
  })

  const handleStopRecording = async () => {
    await stopCapture()
    setState("stopped")
  }

  const handleReset = () => {
    resetCapture()
    setState("idle")
    setResultUrl("")
    setSubmitError(null)
    setStartTime(null)
  }

  const handleSubmit = async (values: {
    title: string
    description: string
    priority: Priority
  }) => {
    const blob = captureType === "video" ? recordedBlob : screenshotBlob
    if (!blob) return

    setState("submitting")
    setSubmitError(null)

    try {
      const durationMs =
        captureType === "video" && startTime ? Date.now() - startTime : 0

      const result = await client.bugReport.create({
        attachment: blob,
        attachmentType: captureType,
        title: values.title || undefined,
        priority: values.priority,
        description: values.description || undefined,
        url: tabInfo.url,
        metadata: {
          duration: formatDuration(durationMs),
          durationMs,
          pageTitle: tabInfo.title,
        },
        deviceInfo: getDeviceInfo(),
      })

      setResultUrl(`${env.VITE_APP_URL}${result.shareUrl}`)
      setState("success")
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : "Failed to submit"
      setSubmitError(msg)
      setState("stopped")
    }
  }

  const activeBlob = captureType === "video" ? recordedBlob : screenshotBlob
  const suggestedTitle =
    tabInfo.title?.trim() ||
    (captureType === "video" ? "Video bug report" : "Screenshot bug report")
  const previewUrl = useMemo(() => {
    if (!activeBlob) return null
    return URL.createObjectURL(activeBlob)
  }, [activeBlob])

  const error = captureError || submitError

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            🦗 Crikket Bug Report
          </CardTitle>
          <CardDescription>
            {state === "idle" && "Ready to capture"}
            {state === "recording" && "Recording in progress..."}
            {state === "stopped" && "Review and submit"}
            {state === "success" && "Report submitted!"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-4 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">{error}</span>
            </div>
          )}

          {state === "idle" && (
            <IdleStep
              captureType={captureType}
              onStartRecording={handleStartCapture}
            />
          )}

          {state === "recording" && (
            <RecordingStep
              duration={duration}
              onStopRecording={handleStopRecording}
            />
          )}

          {(state === "stopped" || state === "submitting") && (
            <FormStep
              captureType={captureType}
              initialTitle={suggestedTitle}
              isSubmitting={state === "submitting"}
              onCancel={handleReset}
              onSubmit={handleSubmit}
              previewUrl={previewUrl}
              submitError={submitError}
            />
          )}

          {state === "success" && (
            <SuccessStep
              onClose={handleReset}
              onCopyLink={() => navigator.clipboard.writeText(resultUrl)}
              onOpenRecording={() => window.open(resultUrl, "_blank")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default App
