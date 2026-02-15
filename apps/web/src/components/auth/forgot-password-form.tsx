"use client"

import { authClient } from "@crikket/auth/client"
import { Button } from "@crikket/ui/components/ui/button"
import { Field, FieldError, FieldLabel } from "@crikket/ui/components/ui/field"
import { Input } from "@crikket/ui/components/ui/input"
import { useCooldown } from "@crikket/ui/hooks/use-cooldown"
import { useForm } from "@tanstack/react-form"
import Link from "next/link"
import { useRouter } from "nextjs-toploader/app"
import { parseAsString, useQueryState } from "nuqs"
import { useState } from "react"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/auth-shell"
import { OtpCodeInput } from "@/components/auth/otp-code-input"
import { getAuthErrorMessage } from "@/lib/auth"
import {
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
} from "@/lib/schema/auth"

export function ForgotPasswordForm() {
  const router = useRouter()
  const [emailQuery] = useQueryState("email", parseAsString.withDefault(""))
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const { isCoolingDown, isHydrated, remainingSeconds, start } = useCooldown({
    durationSeconds: 60,
    key: "auth-code-send",
  })

  const form = useForm({
    defaultValues: {
      email: emailQuery,
      otp: "",
      newPassword: "",
      confirmPassword: "",
    },
    validators: {
      onChange: forgotPasswordResetSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.emailOtp.resetPassword({
        email: value.email,
        otp: value.otp,
        password: value.newPassword,
      })

      if (error) {
        toast.error(getAuthErrorMessage(error))
        return
      }

      toast.success("Password updated. You can sign in now.")
      router.push(`/login?email=${encodeURIComponent(value.email)}`)
    },
  })

  const handleRequestResetCode = async () => {
    const email = form.getFieldValue("email")

    const emailValidation =
      forgotPasswordRequestSchema.shape.email.safeParse(email)
    if (!emailValidation.success) {
      form.setFieldMeta("email", (meta) => ({
        ...meta,
        isTouched: true,
      }))
      toast.error(emailValidation.error.issues[0]?.message ?? "Invalid email")
      return
    }

    try {
      setIsSendingCode(true)

      const { error } = await authClient.emailOtp.requestPasswordReset({
        email,
      })

      if (error) {
        toast.error(getAuthErrorMessage(error))
        return
      }

      setIsCodeSent(true)
      start()
      toast.success("A reset code has been sent to your email.")
    } finally {
      setIsSendingCode(false)
    }
  }

  return (
    <AuthShell
      description="Request a code and choose a new password"
      title="Forgot password"
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.Field name="email">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && field.state.meta.errors.length > 0

            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  aria-invalid={isInvalid}
                  autoComplete="email"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={field.state.value}
                />
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            )
          }}
        </form.Field>

        <Button
          disabled={
            !isHydrated ||
            isSendingCode ||
            isCoolingDown ||
            form.state.isSubmitting
          }
          onClick={handleRequestResetCode}
          type="button"
          variant="outline"
        >
          {isSendingCode
            ? "Sending code..."
            : isCoolingDown
              ? `Send again in ${remainingSeconds}s`
              : "Send reset code"}
        </Button>

        {isCodeSent ? (
          <>
            <form.Field name="otp">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Verification Code
                    </FieldLabel>
                    <OtpCodeInput
                      disabled={isSendingCode || form.state.isSubmitting}
                      id={field.name}
                      isInvalid={isInvalid}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={field.handleChange}
                      value={field.state.value}
                    />
                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="newPassword">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>New Password</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      autoComplete="new-password"
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
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

            <form.Field name="confirmPassword">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Confirm Password
                    </FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      autoComplete="new-password"
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
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

            <Button
              disabled={isSendingCode || form.state.isSubmitting}
              type="submit"
            >
              {form.state.isSubmitting
                ? "Updating password..."
                : "Reset password"}
            </Button>
          </>
        ) : null}
      </form>

      <p className="text-center text-muted-foreground text-sm">
        Remembered your password?{" "}
        <Link
          className="font-medium text-foreground hover:underline"
          href="/login"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
