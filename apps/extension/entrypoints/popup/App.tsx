import { env } from "@crikket/env/extension"
import { useState } from "react"
import { ErrorDisplay } from "./components/error-display"
import { FormStep } from "./components/form-step"
import { InitialStep } from "./components/initial-step"
import { RecordingStep } from "./components/recording-step"
import { SuccessStep } from "./components/success-step"
import { useScreenCapture } from "./hooks/use-screen-capture"
import { client } from "./lib/orpc"
import { getDeviceInfo } from "./lib/utils"
import type { Priority, Step } from "./types"

function App() {
  const [step, setStep] = useState<Step>("initial")
  const [captureType, setCaptureType] = useState<"video" | "screenshot">(
    "video"
  )
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [resultUrl, setResultUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    isRecording,
    recordedBlob,
    screenshotBlob,
    error,
    startRecording,
    stopRecording,
    takeScreenshot,
    reset,
  } = useScreenCapture()

  const handleStartRecording = async () => {
    setCaptureType("video")
    await startRecording()
    setStep("recording")
  }

  const handleStopRecording = async () => {
    const blob = await stopRecording()
    if (blob) {
      setStep("form")
    }
  }

  const handleTakeScreenshot = async () => {
    setCaptureType("screenshot")
    const blob = await takeScreenshot()
    if (blob) {
      setStep("form")
    }
  }

  const handleSubmit = async () => {
    const blob = captureType === "video" ? recordedBlob : screenshotBlob
    if (!blob) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      let currentUrl: string | undefined
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        currentUrl = tabs[0]?.url
      } catch {
        // Extension context may not have tab access
      }

      const result = await client.bugReport.create({
        attachment: blob,
        attachmentType: captureType,
        priority,
        description: description || undefined,
        url: currentUrl,
        deviceInfo: getDeviceInfo(),
      })

      const fullUrl = `${env.VITE_SERVER_URL}${result.shareUrl}`
      setResultUrl(fullUrl)
      setStep("success")

      chrome.tabs.create({ url: fullUrl })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit"
      if (message.includes("UNAUTHORIZED") || message.includes("401")) {
        setSubmitError("Please log in to the web app first.")
      } else {
        setSubmitError(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenRecording = () => {
    chrome.tabs.create({ url: resultUrl })
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(resultUrl)
  }

  const handleReset = () => {
    reset()
    setStep("initial")
    setDescription("")
    setPriority("medium")
    setResultUrl("")
    setSubmitError(null)
  }

  const previewUrl =
    captureType === "video"
      ? recordedBlob
        ? URL.createObjectURL(recordedBlob)
        : null
      : screenshotBlob
        ? URL.createObjectURL(screenshotBlob)
        : null

  return (
    <div className="min-h-[400px] w-[360px] bg-background">
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-4 text-center">
        <h1 className="font-semibold text-lg text-white">🐛 Bug Report</h1>
      </div>

      <div className="p-5">
        {/* Initial State */}
        {step === "initial" && (
          <InitialStep
            onStartRecording={handleStartRecording}
            onTakeScreenshot={handleTakeScreenshot}
          />
        )}

        {/* Recording State */}
        {step === "recording" && (
          <RecordingStep
            isRecording={isRecording}
            onStopRecording={handleStopRecording}
          />
        )}

        {/* Form State */}
        {step === "form" && (
          <FormStep
            captureType={captureType}
            description={description}
            isSubmitting={isSubmitting}
            onCancel={handleReset}
            onDescriptionChange={setDescription}
            onPriorityChange={setPriority}
            onSubmit={handleSubmit}
            previewUrl={previewUrl}
            priority={priority}
            submitError={submitError}
          />
        )}

        {/* Success State */}
        {step === "success" && (
          <SuccessStep
            onClose={handleReset}
            onCopyLink={handleCopyLink}
            onOpenRecording={handleOpenRecording}
          />
        )}

        {/* Error Display */}
        <ErrorDisplay error={error} onRetry={handleReset} />
      </div>
    </div>
  )
}

export default App
