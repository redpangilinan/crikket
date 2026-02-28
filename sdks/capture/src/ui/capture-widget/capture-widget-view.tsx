import { lazy, Suspense } from "react"
import type { CaptureUiHandlers, CaptureUiState } from "../types"
import { ChooserSection } from "./sections/chooser-section"
import { SuccessSection } from "./sections/success-section"

const LazyReviewFormSection = lazy(async () => {
  const module = await import("./sections/review-form-section")

  return {
    default: module.ReviewFormSection,
  }
})

export function CaptureWidgetView(props: {
  handlers: CaptureUiHandlers
  isBusy: boolean
  isSubmitPending: boolean
  state: CaptureUiState
}): React.JSX.Element | null {
  if (props.state.view === "chooser") {
    return (
      <ChooserSection
        busy={props.isBusy}
        onStartVideo={props.handlers.onStartVideo}
        onTakeScreenshot={props.handlers.onTakeScreenshot}
      />
    )
  }

  if (props.state.view === "review") {
    return (
      <Suspense fallback={<ReviewSectionFallback />}>
        <LazyReviewFormSection
          formKey={props.state.reviewFormKey}
          isSubmitting={props.isSubmitPending}
          onCancel={props.handlers.onCancel}
          onSubmit={props.handlers.onSubmit}
          state={props.state}
        />
      </Suspense>
    )
  }

  if (props.state.view === "success") {
    return <SuccessSection handlers={props.handlers} state={props.state} />
  }

  return null
}

function ReviewSectionFallback(): React.JSX.Element {
  return (
    <section className="grid gap-2 px-5 py-8 text-muted-foreground text-sm">
      <p>Preparing review form...</p>
      <p className="text-xs">Your capture is ready. Loading report details.</p>
    </section>
  )
}
