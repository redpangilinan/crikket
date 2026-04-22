"use client"

import { Button } from "@crikket/ui/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@crikket/ui/components/ui/field"
import { Input } from "@crikket/ui/components/ui/input"
import { useForm } from "@tanstack/react-form"
import { useRouter } from "nextjs-toploader/app"
import { useState } from "react"
import { toast } from "sonner"

import { githubIntegrationFormSchema } from "@/lib/schema/settings"
import { client } from "@/utils/orpc"

import { getRequestErrorMessage } from "../_lib/get-request-error-message"

interface GithubIntegrationFormProps {
  initialConfigured: boolean
  initialRepo: string | null
}

export function GithubIntegrationForm({
  initialConfigured,
  initialRepo,
}: GithubIntegrationFormProps) {
  const router = useRouter()
  const [configured, setConfigured] = useState(initialConfigured)
  const [isRemoving, setIsRemoving] = useState(false)

  const form = useForm({
    defaultValues: {
      repo: initialRepo ?? "",
      token: "",
    },
    validators: {
      onChange: githubIntegrationFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (!configured && value.token.trim().length === 0) {
        toast.error("A GitHub token is required the first time.")
        return
      }
      try {
        const result = await client.githubIntegration.upsert({
          repo: value.repo.trim(),
          token:
            value.token.trim().length > 0 ? value.token.trim() : undefined,
        })
        setConfigured(result.configured)
        toast.success("GitHub integration saved")
        // Clear the token field after a successful save so the user can re-enter
        // a different token later without triggering "empty = keep existing" confusion.
        form.setFieldValue("token", "")
        router.refresh()
      } catch (error) {
        toast.error(getRequestErrorMessage(error))
      }
    },
  })

  async function handleRemove() {
    if (
      !window.confirm(
        "Remove the GitHub integration? New bug reports will stop forwarding to the repo."
      )
    ) {
      return
    }
    setIsRemoving(true)
    try {
      await client.githubIntegration.remove()
      setConfigured(false)
      form.reset({ repo: "", token: "" })
      toast.success("GitHub integration removed")
      router.refresh()
    } catch (error) {
      toast.error(getRequestErrorMessage(error))
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        form.handleSubmit()
      }}
    >
      <form.Field name="repo">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && field.state.meta.errors.length > 0

          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Repository</FieldLabel>
              <Input
                aria-invalid={isInvalid}
                autoComplete="off"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="owner/repo"
                value={field.state.value}
              />
              <FieldDescription>
                Must be in <code>owner/repo</code> format (e.g.
                {" "}
                <code>acme/webapp</code>).
              </FieldDescription>
              {isInvalid ? (
                <FieldError errors={field.state.meta.errors} />
              ) : null}
            </Field>
          )
        }}
      </form.Field>

      <form.Field name="token">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && field.state.meta.errors.length > 0

          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>GitHub token</FieldLabel>
              <Input
                aria-invalid={isInvalid}
                autoComplete="off"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={
                  configured
                    ? "•••••••• — leave empty to keep the stored token"
                    : "github_pat_..."
                }
                type="password"
                value={field.state.value}
              />
              <FieldDescription>
                Fine-grained PAT with <strong>Issues: Read and write</strong>{" "}
                and <strong>Contents: Read and write</strong> on the target
                repository. Tokens are encrypted at rest.
              </FieldDescription>
              {isInvalid ? (
                <FieldError errors={field.state.meta.errors} />
              ) : null}
            </Field>
          )
        }}
      </form.Field>

      <div className="flex items-center gap-3">
        <Button disabled={form.state.isSubmitting} type="submit">
          {form.state.isSubmitting
            ? "Saving..."
            : configured
              ? "Update integration"
              : "Save integration"}
        </Button>
        {configured ? (
          <Button
            disabled={isRemoving || form.state.isSubmitting}
            onClick={handleRemove}
            type="button"
            variant="ghost"
          >
            {isRemoving ? "Removing..." : "Remove integration"}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
