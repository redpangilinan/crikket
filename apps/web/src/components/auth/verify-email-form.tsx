"use client"

import { authClient } from "@crikket/auth/client"
import { Button } from "@crikket/ui/components/ui/button"
import { Field, FieldError } from "@crikket/ui/components/ui/field"
import { useCooldown } from "@crikket/ui/hooks/use-cooldown"
import { useForm } from "@tanstack/react-form"
import Link from "next/link"
import { useRouter } from "nextjs-toploader/app"
import { useState } from "react"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/auth-shell"
import { OtpCodeInput } from "@/components/auth/otp-code-input"
import { getAuthErrorMessage } from "@/lib/auth"
import { verifyEmailOtpFormSchema } from "@/lib/schema/auth"
import { client } from "@/utils/orpc"

type VerifyEmailFormProps = {
  email: string
}

export function VerifyEmailForm({ email }: VerifyEmailFormProps) {
  const router = useRouter()
  const [isSendingCode, setIsSendingCode] = useState(false)
  const { isCoolingDown, isHydrated, remainingSeconds, start } = useCooldown({
    durationSeconds: 60,
    key: "auth-code-send",
  })

  const form = useForm({
    defaultValues: {
      otp: "",
    },
    validators: {
      onChange: verifyEmailOtpFormSchema,
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.emailOtp.verifyEmail({
        email,
        otp: value.otp,
      })

      if (error) {
        toast.error(getAuthErrorMessage(error))
        return
      }

      toast.success("Email verified.")
      router.push("/")
      router.refresh()
    },
  })

  const handleSendCode = async () => {
    try {
      setIsSendingCode(true)

      await client.auth.sendEmailVerificationOtpStrict({})

      start()
      toast.success("Verification code sent to your email.")
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to send verification code. Please try again."
      toast.error(errorMessage)
    } finally {
      setIsSendingCode(false)
    }
  }

  return (
    <AuthShell
      description="Enter the code we sent to your email"
      title="Verify email"
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
      >
        <form.Field name="otp">
          {(field) => {
            const isInvalid =
              field.state.meta.isTouched && field.state.meta.errors.length > 0

            return (
              <Field
                className="items-center text-center"
                data-invalid={isInvalid}
              >
                <OtpCodeInput
                  disabled={isSendingCode || form.state.isSubmitting}
                  id={field.name}
                  isInvalid={isInvalid}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
                <p className="text-muted-foreground text-xs">
                  Enter the 6-digit code from your inbox.
                </p>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            )
          }}
        </form.Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            disabled={
              !isHydrated ||
              isSendingCode ||
              isCoolingDown ||
              form.state.isSubmitting
            }
            onClick={handleSendCode}
            type="button"
            variant="outline"
          >
            {isSendingCode
              ? "Sending..."
              : isCoolingDown
                ? `Send again in ${remainingSeconds}s`
                : "Send code"}
          </Button>
          <Button
            disabled={isSendingCode || form.state.isSubmitting}
            type="submit"
          >
            {form.state.isSubmitting ? "Verifying..." : "Verify email"}
          </Button>
        </div>
      </form>

      <p className="text-center text-muted-foreground text-sm">
        Already verified?{" "}
        <Link className="font-medium text-foreground hover:underline" href="/">
          Go to dashboard
        </Link>
      </p>
    </AuthShell>
  )
}
