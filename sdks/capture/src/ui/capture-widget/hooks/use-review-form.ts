import { useMemo, useState } from "react"
import type { CaptureSubmissionDraft } from "../../../types"
import type { ReviewDraftErrors } from "../utils/review-form-schema"
import {
  trimReviewDraftForSubmission,
  validateReviewDraft,
} from "../utils/review-form-schema"

type ReviewDraftField = keyof CaptureSubmissionDraft
type ReviewDraftTouched = Record<ReviewDraftField, boolean>

const INITIAL_TOUCHED_STATE: ReviewDraftTouched = {
  description: false,
  priority: false,
  title: false,
}

export function useReviewForm(input: {
  initialDraft: CaptureSubmissionDraft
  onSubmit: (draft: CaptureSubmissionDraft) => void
}): {
  draft: CaptureSubmissionDraft
  visibleErrors: ReviewDraftErrors
  setFieldValue: <TField extends ReviewDraftField>(
    field: TField,
    value: CaptureSubmissionDraft[TField]
  ) => void
  touchField: (field: ReviewDraftField) => void
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
} {
  const [draft, setDraft] = useState(input.initialDraft)
  const [touched, setTouched] = useState(INITIAL_TOUCHED_STATE)

  const errors = useMemo(() => {
    return validateReviewDraft(draft) ?? {}
  }, [draft])

  const visibleErrors = useMemo(() => {
    const nextVisibleErrors: ReviewDraftErrors = {}

    for (const field of Object.keys(touched) as ReviewDraftField[]) {
      if (touched[field] && errors[field]) {
        nextVisibleErrors[field] = errors[field]
      }
    }

    return nextVisibleErrors
  }, [errors, touched])

  const setFieldValue = <TField extends ReviewDraftField>(
    field: TField,
    value: CaptureSubmissionDraft[TField]
  ): void => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  const touchField = (field: ReviewDraftField): void => {
    setTouched((currentTouched) => {
      if (currentTouched[field]) {
        return currentTouched
      }

      return {
        ...currentTouched,
        [field]: true,
      }
    })
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    event.stopPropagation()

    setTouched({
      description: true,
      priority: true,
      title: true,
    })

    const submitErrors = validateReviewDraft(draft)
    if (submitErrors) {
      return
    }

    input.onSubmit(trimReviewDraftForSubmission(draft))
  }

  return {
    draft,
    handleSubmit,
    setFieldValue,
    touchField,
    visibleErrors,
  }
}
