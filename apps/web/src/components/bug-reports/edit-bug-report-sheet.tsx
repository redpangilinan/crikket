"use client"

import {
  BUG_REPORT_STATUS_OPTIONS,
  BUG_REPORT_VISIBILITY_OPTIONS,
  type BugReportStatus,
  type BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@crikket/ui/components/ui/sheet"
import { useForm } from "@tanstack/react-form"
import { useState } from "react"
import { toast } from "sonner"

import { useAssigneeMembers } from "@/hooks/use-assignee-members"
import { editBugReportFormSchema } from "@/lib/schema/bug-report"
import { client } from "@/utils/orpc"

const statusOptions: Array<{ label: string; value: BugReportStatus }> = [
  { label: "Open", value: BUG_REPORT_STATUS_OPTIONS.open },
  { label: "In Progress", value: BUG_REPORT_STATUS_OPTIONS.inProgress },
  { label: "Resolved", value: BUG_REPORT_STATUS_OPTIONS.resolved },
  { label: "Closed", value: BUG_REPORT_STATUS_OPTIONS.closed },
]

const priorityOptions: Array<{ label: string; value: Priority }> = [
  { label: "Critical", value: PRIORITY_OPTIONS.critical },
  { label: "High", value: PRIORITY_OPTIONS.high },
  { label: "Medium", value: PRIORITY_OPTIONS.medium },
  { label: "Low", value: PRIORITY_OPTIONS.low },
  { label: "None", value: PRIORITY_OPTIONS.none },
]

const visibilityOptions: Array<{ label: string; value: BugReportVisibility }> =
  [
    { label: "Private", value: BUG_REPORT_VISIBILITY_OPTIONS.private },
    { label: "Public", value: BUG_REPORT_VISIBILITY_OPTIONS.public },
  ]

function getStatusLabel(value: BugReportStatus): string {
  return statusOptions.find((option) => option.value === value)?.label ?? value
}

function getPriorityLabel(value: Priority): string {
  return (
    priorityOptions.find((option) => option.value === value)?.label ?? value
  )
}

function getVisibilityLabel(value: BugReportVisibility): string {
  return (
    visibilityOptions.find((option) => option.value === value)?.label ?? value
  )
}

function parseTagInput(tagInput: string): string[] {
  return Array.from(
    new Set(
      tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  )
}

interface EditBugReportSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => Promise<void> | void
  report: {
    id: string
    title: string | null | undefined
    tags: string[]
    status: BugReportStatus
    priority: Priority
    assigneeId: string | null
    visibility: BugReportVisibility
  }
}

export function EditBugReportSheet({
  open,
  onOpenChange,
  onUpdated,
  report,
}: EditBugReportSheetProps) {
  const [isSaving, setIsSaving] = useState(false)
  const { organizationId, membersQuery } = useAssigneeMembers(open)
  const members = membersQuery.data ?? []

  const form = useForm({
    defaultValues: {
      title: report.title ?? "",
      tagsInput: report.tags.join(", "),
      status: report.status,
      priority: report.priority,
      assigneeId: report.assigneeId,
      visibility: report.visibility,
    },
    validators: {
      onChange: editBugReportFormSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSaving(true)

      try {
        await client.bugReport.update({
          id: report.id,
          title: value.title.trim(),
          tags: parseTagInput(value.tagsInput),
          status: value.status,
          priority: value.priority,
          assigneeId: value.assigneeId,
          visibility: value.visibility,
        })
        await onUpdated?.()
        toast.success("Bug report updated")
        onOpenChange(false)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update bug report"
        toast.error(message)
      } finally {
        setIsSaving(false)
      }
    },
  })

  const resetFormValues = () => {
    form.reset({
      title: report.title ?? "",
      tagsInput: report.tags.join(", "),
      status: report.status,
      priority: report.priority,
      assigneeId: report.assigneeId,
      visibility: report.visibility,
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      resetFormValues()
    }
    onOpenChange(nextOpen)
  }

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetContent className="w-full">
        <SheetHeader>
          <SheetTitle>Edit bug report</SheetTitle>
          <SheetDescription>
            Update report details, tags, priority, status, and privacy.
          </SheetDescription>
        </SheetHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
        >
          <div className="space-y-4 px-4">
            <form.Field name="title">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      maxLength={200}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Bug report title"
                      value={field.state.value}
                    />
                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="tagsInput">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Tags</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="auth, dashboard, onboarding"
                      value={field.state.value}
                    />
                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="status">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                    <Select
                      onValueChange={(value) =>
                        field.handleChange(value as BugReportStatus)
                      }
                      value={field.state.value}
                    >
                      <SelectTrigger className="w-full" id={field.name}>
                        <SelectValue>
                          {getStatusLabel(field.state.value)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>

              <form.Field name="priority">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Priority</FieldLabel>
                    <Select
                      onValueChange={(value) =>
                        field.handleChange(value as Priority)
                      }
                      value={field.state.value}
                    >
                      <SelectTrigger className="w-full" id={field.name}>
                        <SelectValue>
                          {getPriorityLabel(field.state.value)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
            </div>

            <form.Field name="assigneeId">
              {(field) => {
                const selectedMember = members.find(
                  (member) => member.userId === field.state.value
                )

                const selectedLabel =
                  field.state.value === null
                    ? "Unassigned"
                    : (selectedMember?.user.name ?? "Current assignee")

                return (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Assignee</FieldLabel>

                    <Select
                      disabled={
                        !organizationId ||
                        membersQuery.isPending ||
                        membersQuery.isError ||
                        isSaving
                      }
                      onValueChange={(value) => {
                        if (typeof value !== "string") {
                          return
                        }

                        field.handleChange(
                          value === "__unassigned__" ? null : value
                        )
                      }}
                      value={field.state.value ?? "__unassigned__"}
                    >
                      <SelectTrigger className="w-full" id={field.name}>
                        <SelectValue>
                          {membersQuery.isPending
                            ? "Loading members..."
                            : selectedLabel}
                        </SelectValue>
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="__unassigned__">
                          Unassigned
                        </SelectItem>

                        {field.state.value && !selectedMember ? (
                          <SelectItem disabled value={field.state.value}>
                            Current assignee — unavailable
                          </SelectItem>
                        ) : null}

                        {members.map((member) => (
                          <SelectItem key={member.userId} value={member.userId}>
                            {member.user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {membersQuery.isError ? (
                      <div role="alert">
                        <p className="text-destructive text-sm">
                          Could not load organization members.
                        </p>
                        <Button
                          onClick={() => membersQuery.refetch()}
                          type="button"
                          variant="ghost"
                        >
                          Retry
                        </Button>
                      </div>
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="visibility">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Privacy</FieldLabel>
                  <Select
                    onValueChange={(value) =>
                      field.handleChange(value as BugReportVisibility)
                    }
                    value={field.state.value}
                  >
                    <SelectTrigger className="w-full" id={field.name}>
                      <SelectValue>
                        {getVisibilityLabel(field.state.value)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {visibilityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          </div>

          <SheetFooter className="mt-0 space-y-1 border-t pt-3">
            <Button
              disabled={isSaving || form.state.isSubmitting}
              type="submit"
            >
              {isSaving || form.state.isSubmitting
                ? "Saving..."
                : "Save changes"}
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
