"use client"

import { authClient } from "@crikket/auth/client"
import { Button } from "@crikket/ui/components/ui/button"
import { Field, FieldError, FieldLabel } from "@crikket/ui/components/ui/field"
import { Input } from "@crikket/ui/components/ui/input"
import { useForm } from "@tanstack/react-form"
import Link from "next/link"
import { useRouter } from "nextjs-toploader/app"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/auth-shell"
import { getAuthErrorMessage } from "@/lib/auth"
import { resetPasswordFormSchema } from "@/lib/schema/auth"

export function ResetPasswordForm() {
  const router = useRouter()
  const [tokenQuery] = useQueryState("token", parseAsString)

  const form = useForm({
    defaultValues: {
      token: tokenQuery ?? "",
      newPassword: "",
    },
    validators: {
      onChange: resetPasswordFormSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.resetPassword({
        token: value.token,
        newPassword: value.newPassword,
      })

      if (error) {
        toast.error(getAuthErrorMessage(error))
        return
      }

      toast.success("Password reset complete. Sign in with your new password.")
      router.push("/login")
    },
  })

  const token = form.getFieldValue("token")

  return (
    <AuthShell description="Enter your new password" title="Reset password">
      {token ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
        >
          <form.Field name="newPassword">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && field.state.meta.errors.length > 0

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>New Password</FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    autoComplete="new-password"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="••••••••"
                    required
                    type="password"
                    value={field.state.value}
                  />
                  {isInvalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          <Button disabled={form.state.isSubmitting} type="submit">
            {form.state.isSubmitting
              ? "Resetting password..."
              : "Reset password"}
          </Button>
        </form>
      ) : (
        <div className="grid gap-2 rounded-lg border border-dashed p-4">
          <p className="text-sm">
            This reset link is missing a token or has expired. Request a new one
            to continue.
          </p>
          <Link
            className="font-medium text-sm underline"
            href="/forgot-password"
          >
            Go to forgot password
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
