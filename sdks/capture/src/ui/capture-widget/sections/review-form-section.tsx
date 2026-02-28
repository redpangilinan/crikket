import type { CaptureSubmissionDraft } from "../../../types"
import type { CaptureUiState } from "../../types"
import { MediaPreview } from "../components/media-preview"
import { Button } from "../components/primitives/button"
import { Field, FieldError } from "../components/primitives/field"
import { Input } from "../components/primitives/input"
import { Label } from "../components/primitives/label"
import { Textarea } from "../components/primitives/textarea"
import { SummaryStat } from "../components/summary-stat"
import { useReviewForm } from "../hooks/use-review-form"
import { capturePriorityOptions } from "../utils/review-form-schema"

interface ReviewFormSectionProps {
  formKey: string
  isSubmitting: boolean
  state: CaptureUiState
  onCancel: () => void
  onSubmit: (draft: CaptureSubmissionDraft) => void
}

export function ReviewFormSection({
  formKey,
  isSubmitting,
  state,
  onCancel,
  onSubmit,
}: ReviewFormSectionProps): React.JSX.Element {
  const form = useReviewForm({
    initialDraft: state.reviewDraft,
    onSubmit,
  })

  return (
    <section className="grid gap-4 p-5" key={formKey}>
      <div className="overflow-hidden rounded-xl border bg-muted/60">
        <MediaPreview media={state.media} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryStat label="Actions" value={state.summary.actions} />
        <SummaryStat label="Logs" value={state.summary.logs} />
        <SummaryStat label="Network" value={state.summary.networkRequests} />
      </div>

      {state.warnings.length > 0 ? (
        <ul className="m-0 grid gap-1 pl-5 text-muted-foreground text-xs">
          {state.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <form className="grid gap-4" onSubmit={form.handleSubmit}>
        <Field data-invalid={Boolean(form.visibleErrors.title)}>
          <Label htmlFor={`${formKey}-title`}>Title (Optional)</Label>
          <Input
            aria-invalid={Boolean(form.visibleErrors.title)}
            id={`${formKey}-title`}
            maxLength={200}
            onBlur={() => {
              form.touchField("title")
            }}
            onChange={(event) => {
              form.setFieldValue("title", event.currentTarget.value)
            }}
            placeholder="What went wrong?"
            value={form.draft.title}
          />
          {form.visibleErrors.title ? (
            <FieldError errors={[form.visibleErrors.title]} />
          ) : null}
        </Field>

        <Field data-invalid={Boolean(form.visibleErrors.description)}>
          <Label htmlFor={`${formKey}-description`}>Description</Label>
          <Textarea
            aria-invalid={Boolean(form.visibleErrors.description)}
            className="min-h-24 resize-y"
            id={`${formKey}-description`}
            maxLength={4000}
            onBlur={() => {
              form.touchField("description")
            }}
            onChange={(event) => {
              form.setFieldValue("description", event.currentTarget.value)
            }}
            placeholder="Steps to reproduce, expected behavior, and what happened."
            value={form.draft.description}
          />
          {form.visibleErrors.description ? (
            <FieldError errors={[form.visibleErrors.description]} />
          ) : null}
        </Field>

        <Field data-invalid={Boolean(form.visibleErrors.priority)}>
          <Label htmlFor={`${formKey}-priority`}>Priority</Label>
          <select
            aria-invalid={Boolean(form.visibleErrors.priority)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60"
            id={`${formKey}-priority`}
            onBlur={() => {
              form.touchField("priority")
            }}
            onChange={(event) => {
              form.setFieldValue(
                "priority",
                event.currentTarget.value as CaptureSubmissionDraft["priority"]
              )
            }}
            value={form.draft.priority}
          >
            {capturePriorityOptions.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
          {form.visibleErrors.priority ? (
            <FieldError errors={[form.visibleErrors.priority]} />
          ) : null}
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Button
            className="w-full"
            disabled={state.busy || isSubmitting}
            type="submit"
          >
            Submit Report
          </Button>
          <Button
            className="w-full"
            disabled={state.busy || isSubmitting}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Start Over
          </Button>
        </div>
      </form>
    </section>
  )
}
