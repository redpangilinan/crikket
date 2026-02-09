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
import { useEffect } from "react"
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

export function FormStep({
  captureType,
  previewUrl,
  initialTitle,
  isSubmitting,
  submitError,
  preSubmitWarnings,
  debuggerSummary,
  onSubmit,
  onCancel,
}: FormStepProps) {
  const form = useForm({
    defaultValues: {
      title: initialTitle,
      description: "",
      priority: "medium" as Priority,
    },
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

  useEffect(() => {
    if (!form.state.values.title && initialTitle) {
      form.setFieldValue("title", initialTitle)
    }
  }, [form, initialTitle])

  return (
    <div className="space-y-6">
      {/* Preview */}
      {previewUrl && (
        <div className="overflow-hidden rounded-lg border bg-black">
          {captureType === "video" ? (
            <video
              className="w-full"
              controls
              src={previewUrl}
              style={{ maxHeight: "400px" }}
            >
              <track kind="captions" />
            </video>
          ) : (
            <img
              alt="Screenshot preview"
              className="w-full"
              src={previewUrl}
              style={{ maxHeight: "400px", objectFit: "contain" }}
            />
          )}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
      >
        {/* Form */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="font-medium text-slate-700 text-sm">
              Captured debugger data
            </p>
            <p className="mt-1 text-slate-600 text-xs">
              Actions: {debuggerSummary.actions} | Logs: {debuggerSummary.logs}{" "}
              | Requests: {debuggerSummary.networkRequests}
            </p>
          </div>

          {preSubmitWarnings.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="font-medium text-amber-700 text-sm">
                Please review before submitting
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-700 text-xs">
                {preSubmitWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <form.Field name="title">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && field.state.meta.errors.length > 0
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Title (Optional)</FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Give this report a quick title"
                    value={field.state.value}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>

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

          <form.Field name="priority">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && field.state.meta.errors.length > 0
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Priority</FieldLabel>
                  <Select
                    onValueChange={(value) => {
                      if (value) {
                        field.handleChange(value as Priority)
                      }
                    }}
                    value={field.state.value}
                  >
                    <SelectTrigger aria-invalid={isInvalid} id={field.name}>
                      <SelectValue className="capitalize" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityValues.map((priority) => (
                        <SelectItem
                          className="capitalize"
                          key={priority}
                          value={priority}
                        >
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>
        </div>

        {/* Error */}
        {submitError && (
          <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-red-400 text-sm">{submitError}</p>
          </div>
        )}

        {/* Actions */}
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
