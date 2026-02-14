/** @jsxImportSource react */
import { env } from "@crikket/env/server"
import { sendAuthEmail } from "./send-auth-email"
import type { AuthEmailOtpType } from "./templates/email-otp-template"
import { AuthEmailOtpTemplate } from "./templates/email-otp-template"
import { EmailVerificationLinkTemplate } from "./templates/email-verification-link-template"
import { PasswordResetLinkTemplate } from "./templates/password-reset-link-template"

type SendEmailOtpEmailInput = {
  email: string
  otp: string
  type: AuthEmailOtpType
}

type SendEmailVerificationLinkEmailInput = {
  email: string
  verificationUrl: string
}

type SendPasswordResetLinkEmailInput = {
  email: string
  resetUrl: string
}

const OTP_SUBJECTS: Record<AuthEmailOtpType, string> = {
  "email-verification": "Verify your email",
  "forget-password": "Reset your password",
  "sign-in": "Your sign-in code",
}

const OTP_ACTION_URLS: Record<AuthEmailOtpType, string> = {
  "email-verification": "/verify-email",
  "forget-password": "/forgot-password",
  "sign-in": "/login",
}

export const sendEmailOtpEmail = async ({
  email,
  otp,
  type,
}: SendEmailOtpEmailInput): Promise<void> => {
  const actionUrl = new URL(OTP_ACTION_URLS[type], env.BETTER_AUTH_URL)
  actionUrl.searchParams.set("email", email)

  await sendAuthEmail({
    to: email,
    subject: OTP_SUBJECTS[type],
    text: `Your security code is ${otp}. It expires in 10 minutes.`,
    react: (
      <AuthEmailOtpTemplate
        actionUrl={actionUrl.toString()}
        otp={otp}
        type={type}
      />
    ),
  })
}

export const sendEmailVerificationLinkEmail = async ({
  email,
  verificationUrl,
}: SendEmailVerificationLinkEmailInput): Promise<void> => {
  await sendAuthEmail({
    to: email,
    subject: "Verify your email address",
    text: `Verify your email using this link: ${verificationUrl}`,
    react: <EmailVerificationLinkTemplate verificationUrl={verificationUrl} />,
  })
}

export const sendPasswordResetLinkEmail = async ({
  email,
  resetUrl,
}: SendPasswordResetLinkEmailInput): Promise<void> => {
  await sendAuthEmail({
    to: email,
    subject: "Reset your password",
    text: `Reset your password using this link: ${resetUrl}`,
    react: <PasswordResetLinkTemplate resetUrl={resetUrl} />,
  })
}
