import {
  buildDebuggerSubmissionPayload,
  hasDebuggerPayloadData,
} from "@crikket/capture-core/debugger/payload"
import { readDebuggerSessionIdFromSearch } from "@crikket/capture-core/debugger/recorder-session"
import type { BugReportDebuggerPayload } from "@crikket/capture-core/debugger/types"
import { env } from "@crikket/env/extension"
import type { Priority } from "@crikket/shared/constants/priorities"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { AlertCircle } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FormStep } from "@/components/form-step"
import { MicReadyStep } from "@/components/mic-ready-step"
import { RecordingStep } from "@/components/recording-step"
import { SuccessStep } from "@/components/success-step"
import { useCaptureContext } from "@/hooks/use-capture-context"
import { useCommandShortcuts } from "@/hooks/use-command-shortcuts"
import { useMicAutoStart } from "@/hooks/use-mic-auto-start"
import { useMicrophonePreference } from "@/hooks/use-microphone-preference"
import { type CaptureType, useRecorderInit } from "@/hooks/use-recorder-init"
import { useRecorderRecordingSync } from "@/hooks/use-recorder-recording-sync"
import { useScreenCapture } from "@/hooks/use-screen-capture"
import { useTimer } from "@/hooks/use-timer"
import {
  discardDebuggerSession,
  getDebuggerSessionSnapshot,
  markDebuggerRecordingStarted,
} from "@/lib/bug-report-debugger/client"
import { submitBugReportWithUploads } from "@/lib/bug-report-upload"
import {
  buildCaptureContextSubmissionData,
  type DebuggerCaptureSummary,
  dedupeMessages,
  EMPTY_DEBUGGER_SUMMARY,
  getDebuggerCaptureSummary,
  getSubmissionErrorMessage,
  isUnauthorizedSubmissionError,
  normalizeOptionalText,
} from "@/lib/recorder-submit"
import { focusCurrentTab, formatDuration, getDeviceInfo } from "@/lib/utils"

type State =
  | "idle"
  | "ready"
  | "recording"
  | "stopped"
  | "submitting"
  | "success"

const STATE_DESCRIPTIONS: Partial<Record<State, string>> = {
  idle: "Esperando captura",
  recording: "Grabación en progreso...",
  stopped: "Revisar y enviar",
  success: "¡Reporte enviado!",
}

interface DebuggerSubmissionInput {
  sessionId: string | null
  payload: BugReportDebuggerPayload | undefined
  summary: DebuggerCaptureSummary
  warnings: string[]
}

function App() {
  const shortcuts = useCommandShortcuts()
  const [state, setState] = useState<State>("idle")
  const [captureType, setCaptureType] = useState<CaptureType>("video")
  const [microphoneEnabled, setMicrophoneEnabled] = useMicrophonePreference()
  const [fullScreenEnabled, setFullScreenEnabled] = useState(false)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [recordedDurationMs, setRecordedDurationMs] = useState<number | null>(
    null
  )
  const [resultUrl, setResultUrl] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submissionWarnings, setSubmissionWarnings] = useState<string[]>([])
  const [preSubmitWarnings, setPreSubmitWarnings] = useState<string[]>([])
  const [debuggerSummary, setDebuggerSummary] =
    useState<DebuggerCaptureSummary>(EMPTY_DEBUGGER_SUMMARY)
  const debuggerSessionId = useMemo(
    () => readDebuggerSessionIdFromSearch(window.location.search),
    []
  )

  const captureContext = useCaptureContext()

  const {
    startRecording: startCapture,
    stopRecording: stopCapture,
    takeScreenshot: captureScreenshot,
    recordedBlob,
    screenshotBlob,
    error: captureError,
    reset: resetCapture,
    setScreenshotBlob,
  } = useScreenCapture({ fullScreenEnabled, microphoneEnabled })

  const duration = useTimer(startTime, state === "recording")

  const clearDebuggerState = useCallback(async () => {
    if (debuggerSessionId) {
      await discardDebuggerSession(debuggerSessionId).catch(
        (error: unknown) => {
          reportNonFatalError(
            "Failed to discard debugger session during reset",
            error
          )
        }
      )
    }
  }, [debuggerSessionId])

  const getDebuggerSubmissionInput = useCallback(async () => {
    const warnings: string[] = []
    const sessionId = debuggerSessionId
    if (!sessionId) {
      warnings.push(
        "No se encontró la sesión de depuración. Este reporte puede carecer de registros capturados."
      )
      return {
        sessionId: null,
        payload: undefined,
        summary: EMPTY_DEBUGGER_SUMMARY,
        warnings,
      } satisfies DebuggerSubmissionInput
    }

    const snapshot = await getDebuggerSessionSnapshot(sessionId).catch(
      (error: unknown) => {
        reportNonFatalError(
          `Failed to load debugger snapshot for session ${sessionId}`,
          error
        )
        return null
      }
    )

    if (!snapshot) {
      warnings.push(
        "No se pudo cargar la instantánea de depuración. Este reporte puede carecer de registros capturados."
      )
      return {
        sessionId,
        payload: undefined,
        summary: EMPTY_DEBUGGER_SUMMARY,
        warnings,
      } satisfies DebuggerSubmissionInput
    }

    const payload = buildDebuggerSubmissionPayload(snapshot)
    const summary = getDebuggerCaptureSummary(payload)
    const hasPayloadData = hasDebuggerPayloadData(payload)

    if (!hasPayloadData) {
      warnings.push(
        "Aún no se capturaron eventos de depuración. Reproduce el problema antes de enviar si necesitas registros de red/acciones."
      )
    } else if (summary.networkRequests === 0) {
      warnings.push(
        "No se capturaron solicitudes de red en esta grabación. Los datos de depuración a nivel API pueden estar incompletos."
      )
    }

    return {
      sessionId,
      payload: hasPayloadData ? payload : undefined,
      summary,
      warnings,
    } satisfies DebuggerSubmissionInput
  }, [debuggerSessionId])

  const handleStopRecording = useCallback(async () => {
    const stoppedAt = Date.now()
    await stopCapture()
    if (startTime) {
      setRecordedDurationMs(Math.max(0, stoppedAt - startTime))
    }
    setState("stopped")
  }, [startTime, stopCapture])

  useRecorderRecordingSync({
    captureType,
    onStopFromPopup: handleStopRecording,
    state,
  })

  const startVideoCapture = useCallback(async () => {
    const success = await startCapture()
    if (success) {
      const startedAt = Date.now()
      const sessionId = debuggerSessionId
      if (sessionId) {
        await markDebuggerRecordingStarted({
          sessionId,
          recordingStartedAt: startedAt,
        }).catch((error: unknown) => {
          reportNonFatalError(
            `Failed to mark debugger recording start for session ${sessionId}`,
            error
          )
        })
      }

      setStartTime(startedAt)
      setRecordedDurationMs(null)
      setState("recording")
    }
  }, [debuggerSessionId, startCapture])

  const handleStartCapture = useCallback(async () => {
    if (captureType === "screenshot") {
      const blob = await captureScreenshot()
      if (blob) {
        setRecordedDurationMs(null)
        setState("stopped")
      }
      return
    }

    await startVideoCapture()
  }, [captureScreenshot, captureType, startVideoCapture])

  useEffect(() => {
    if (state === "recording" && recordedBlob) {
      if (startTime) {
        setRecordedDurationMs(Math.max(0, Date.now() - startTime))
      }
      setState("stopped")
      // The capture ended on its own (e.g. the browser's "Stop sharing"
      // button), so bring the review form back into view.
      focusCurrentTab().catch((error: unknown) => {
        reportNonFatalError("Failed to focus recorder tab after capture", error)
      })
    }
  }, [recordedBlob, startTime, state])

  useEffect(() => {
    if (state !== "stopped") {
      setPreSubmitWarnings([])
      return
    }

    let isCancelled = false

    getDebuggerSubmissionInput()
      .then((debuggerInput) => {
        if (isCancelled) {
          return
        }

        setDebuggerSummary(debuggerInput.summary)
        setPreSubmitWarnings(debuggerInput.warnings)
      })
      .catch((error: unknown) => {
        reportNonFatalError(
          "Failed to inspect debugger data before bug report submission",
          error
        )
        if (isCancelled) {
          return
        }

        setDebuggerSummary(EMPTY_DEBUGGER_SUMMARY)
        setPreSubmitWarnings([
          "No se pudieron validar los datos de depuración antes de enviar.",
        ])
      })

    return () => {
      isCancelled = true
    }
  }, [getDebuggerSubmissionInput, state])

  useRecorderInit({
    onCaptureTypeChange: setCaptureType,
    onScreenshotLoaded: (blob) => {
      setScreenshotBlob(blob)
      setRecordedDurationMs(null)
      setState("stopped")
    },
    onStartRecording: handleStartCapture,
    onReadyToRecord: (options) => {
      setMicrophoneEnabled(options.microphoneEnabled)
      setFullScreenEnabled(options.fullScreenEnabled)
      setState("ready")
    },
    onError: (err) => setSubmitError(err),
  })

  useMicAutoStart(state, handleStartCapture, !fullScreenEnabled)

  const handleReset = () => {
    resetCapture()
    setState("idle")
    setResultUrl("")
    setSubmitError(null)
    setSubmissionWarnings([])
    setPreSubmitWarnings([])
    setDebuggerSummary(EMPTY_DEBUGGER_SUMMARY)
    setRecordedDurationMs(null)
    setStartTime(null)
    clearDebuggerState().catch((error: unknown) => {
      reportNonFatalError("Failed to clear debugger state after reset", error)
    })
  }

  const handleSubmit = async (values: {
    title: string
    description: string
    priority: Priority
  }) => {
    const blob = captureType === "video" ? recordedBlob : screenshotBlob
    if (!blob || blob.size === 0) {
      setSubmitError(
        "Los datos de captura faltan. Por favor, captura nuevamente."
      )
      setState("stopped")
      return
    }

    setState("submitting")
    setSubmitError(null)
    setSubmissionWarnings([])

    try {
      const durationMs =
        captureType === "video"
          ? Math.max(
              0,
              recordedDurationMs ?? (startTime ? Date.now() - startTime : 0)
            )
          : 0
      const debuggerSubmission = await getDebuggerSubmissionInput()
      const captureContextSubmissionData =
        buildCaptureContextSubmissionData(captureContext)
      const warnings = [
        ...debuggerSubmission.warnings,
        ...captureContextSubmissionData.warnings,
      ]

      const result = await submitBugReportWithUploads({
        attachment: blob,
        attachmentType: captureType,
        title: normalizeOptionalText(values.title, 200),
        priority: values.priority,
        description: normalizeOptionalText(values.description, 3000),
        url: captureContextSubmissionData.normalizedUrl,
        metadata: {
          duration: formatDuration(durationMs),
          durationMs,
          pageTitle: captureContextSubmissionData.normalizedPageTitle,
        },
        deviceInfo: getDeviceInfo(),
        debuggerPayload: debuggerSubmission.payload,
        debuggerSummary: debuggerSubmission.summary,
      })

      if (debuggerSubmission.sessionId) {
        await discardDebuggerSession(debuggerSubmission.sessionId).catch(
          (error: unknown) => {
            reportNonFatalError(
              `Failed to discard debugger session ${debuggerSubmission.sessionId} after submission`,
              error
            )
          }
        )
      }

      setResultUrl(`${env.VITE_APP_URL}${result.shareUrl}`)
      setSubmissionWarnings(
        dedupeMessages([...warnings, ...(result.warnings ?? [])])
      )
      setState("success")
    } catch (error) {
      if (isUnauthorizedSubmissionError(error)) {
        const loginUrl = new URL("/login", env.VITE_APP_URL).toString()
        window.open(loginUrl, "_blank", "noopener,noreferrer")
      }
      setSubmitError(getSubmissionErrorMessage(error))
      setState("stopped")
    }
  }

  const activeBlob = captureType === "video" ? recordedBlob : screenshotBlob
  const suggestedTitle =
    captureContext.title?.trim() ||
    (captureType === "video"
      ? "Reporte de video"
      : "Reporte de captura de pantalla")
  const previewUrl = useMemo(() => {
    if (!activeBlob) return null
    return URL.createObjectURL(activeBlob)
  }, [activeBlob])

  const error = captureError || submitError

  useEffect(() => {
    if (state === "recording") {
      document.title = `Grabando ${formatDuration(duration)} - Crikket`
      return
    }

    document.title = "Crikket - Reporte de error"
  }, [duration, state])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100/80 p-6 sm:p-8">
      <Card className="w-full max-w-3xl border-border/80 shadow-lg shadow-slate-950/5">
        <CardHeader className="gap-2 border-b bg-muted/20 text-left">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            Crikket - Reporte de error
          </CardTitle>
          <CardDescription className="text-sm">
            {STATE_DESCRIPTIONS[state]}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 py-6">
          {error ? (
            <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-4 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">{error}</span>
            </div>
          ) : null}

          {state === "idle" ? (
            <p className="text-center text-muted-foreground">
              Sin captura activa. Inicia desde el popup de la extensión.
            </p>
          ) : null}

          {state === "ready" ? (
            <MicReadyStep
              fullScreenEnabled={fullScreenEnabled}
              microphoneEnabled={microphoneEnabled}
              onStart={handleStartCapture}
            />
          ) : null}

          {state === "recording" ? (
            <RecordingStep
              duration={duration}
              onStopRecording={handleStopRecording}
              stopRecordingShortcut={shortcuts.stopRecording}
            />
          ) : null}

          {state === "stopped" || state === "submitting" ? (
            <FormStep
              captureType={captureType}
              debuggerSummary={debuggerSummary}
              initialTitle={suggestedTitle}
              isSubmitting={state === "submitting"}
              onCancel={handleReset}
              onSubmit={handleSubmit}
              preSubmitWarnings={preSubmitWarnings}
              previewUrl={previewUrl}
              submitError={submitError}
              videoDurationMs={
                captureType === "video"
                  ? (recordedDurationMs ?? (duration > 0 ? duration : null))
                  : null
              }
            />
          ) : null}

          {state === "success" ? (
            <SuccessStep
              onClose={() => window.close()}
              onCopyLink={() => navigator.clipboard.writeText(resultUrl)}
              onOpenRecording={() => window.open(resultUrl, "_blank")}
              warnings={submissionWarnings}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default App
