import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import { Button } from "@crikket/ui/components/ui/button"
import { Field, FieldError, FieldLabel } from "@crikket/ui/components/ui/field"
import { Input } from "@crikket/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import { Textarea } from "@crikket/ui/components/ui/textarea"
import { useForm } from "@tanstack/react-form"
import { AlertTriangle } from "lucide-react"
import { type SyntheticEvent, useCallback, useEffect, useRef } from "react"
import * as z from "zod"

const priorityValues = Object.values(PRIORITY_OPTIONS) as [
  Priority,
  ...Priority[],
]

const formSchema = z.object({
  title: z.string().max(200, "Title must be at most 200 characters."),
  description: z
    .string()
    .max(3000, "Description must be at most 3000 characters."),
  priority: z.enum(priorityValues),
})

interface DebuggerSummary {
  actions: number
  logs: number
  networkRequests: number
}

interface FormStepProps {
  captureType: "video" | "screenshot"
  previewUrl: string | null
  videoDurationMs: number | null
  initialTitle: string
  isSubmitting: boolean
  submitError: string | null
  preSubmitWarnings: string[]
  debuggerSummary: DebuggerSummary
  onSubmit: (values: {
    title: string
    description: string
    priority: Priority
  }) => void
  onCancel: () => void
}

interface FormValues {
  title: string
  description: string
  priority: Priority
}

export function FormStep({
  captureType,
  previewUrl,
  videoDurationMs,
  initialTitle,
  isSubmitting,
  submitError,
  preSubmitWarnings,
  debuggerSummary,
  onSubmit,
  onCancel,
}: FormStepProps) {
  const defaultValues: FormValues = {
    title: initialTitle,
    description: "",
    priority: PRIORITY_OPTIONS.none,
  }

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        title: value.title,
        description: value.description,
        priority: value.priority,
      })
    },
  })

  const isBusy = isSubmitting || form.state.isSubmitting
  const totalCapturedEvents =
    debuggerSummary.actions +
    debuggerSummary.logs +
    debuggerSummary.networkRequests
  const isPrimingVideoDurationRef = useRef(false)

  useEffect(() => {
    if (!form.state.values.title && initialTitle) {
      form.setFieldValue("title", initialTitle)
    }
  }, [form, initialTitle])

  const handleVideoLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      const player = event.currentTarget
      if (isPrimingVideoDurationRef.current) {
        return
      }

      if (!(typeof videoDurationMs === "number" && videoDurationMs > 0)) {
        return
      }

      if (Number.isFinite(player.duration) && player.duration > 0) {
        return
      }

      const durationSeconds = videoDurationMs / 1000
      const safeSeekTargetSeconds = Math.max(0, durationSeconds - 0.001)
      if (safeSeekTargetSeconds <= 0) {
        return
      }

      isPrimingVideoDurationRef.current = true
      const originalTime = player.currentTime

      const restorePosition = () => {
        const maxDurationSeconds =
          Number.isFinite(player.duration) && player.duration > 0
            ? player.duration
            : durationSeconds
        player.currentTime = Math.min(originalTime, maxDurationSeconds)
        isPrimingVideoDurationRef.current = false
      }

      player.addEventListener("seeked", restorePosition, { once: true })

      try {
        player.currentTime = safeSeekTargetSeconds
      } catch {
        isPrimingVideoDurationRef.current = false
      }
    },
    [videoDurationMs]
  )

  return (
    <div className="space-y-6">
      {previewUrl && (
        <div className="overflow-hidden rounded-xl border bg-black shadow-sm">
          {captureType === "video" ? (
            <div className="relative">
              <video
                className="max-h-[400px] w-full bg-black object-contain"
                controls
                onLoadedMetadata={handleVideoLoadedMetadata}
                preload="metadata"
                src={previewUrl}
              >
                <track kind="captions" />
              </video>
            </div>
          ) : (
            <img
              alt="Screenshot preview"
              className="max-h-[400px] w-full bg-black object-contain"
              src={previewUrl}
            />
          )}
        </div>
      )}

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="space-y-4">
          <section className="space-y-2 rounded-xl border bg-muted/20 p-4">
            <p className="font-medium text-sm">Captured debugger data</p>
            <p className="text-muted-foreground text-xs">
              {totalCapturedEvents} total events
            </p>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
              <span>Actions: {debuggerSummary.actions}</span>
              <span aria-hidden="true">•</span>
              <span>Logs: {debuggerSummary.logs}</span>
              <span aria-hidden="true">•</span>
              <span>Requests: {debuggerSummary.networkRequests}</span>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_190px]">
            <form.Field name="title">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Title (Optional)
                    </FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Give this report a quick title"
                      value={field.state.value}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="priority">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Priority (Optional)
                    </FieldLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value) {
                          field.handleChange(value as Priority)
                        }
                      }}
                      value={field.state.value}
                    >
                      <SelectTrigger
                        aria-invalid={isInvalid}
                        className="w-full"
                        id={field.name}
                      >
                        <SelectValue className="capitalize" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityValues.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {formatPriorityLabel(priority)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </div>

          <form.Field name="description">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && field.state.meta.errors.length > 0
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Description (Optional)
                  </FieldLabel>
                  <Textarea
                    aria-invalid={isInvalid}
                    className="resize-none"
                    id={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Describe what went wrong..."
                    rows={4}
                    value={field.state.value}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>
        </div>

        {preSubmitWarnings.length > 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 font-medium text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Review before submitting
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800 text-xs">
              {preSubmitWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {submitError && (
          <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-red-400 text-sm">{submitError}</p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button
            className="flex-1"
            disabled={isBusy}
            onClick={() => {
              form.reset()
              onCancel()
            }}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button className="flex-1" disabled={isBusy} type="submit">
            {isBusy ? "Submitting..." : "Submit Bug Report"}
          </Button>
        </div>
      </form>
    </div>
  )
}

function formatPriorityLabel(priority: Priority): string {
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)}`
}
