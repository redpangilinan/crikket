/** @jsxImportSource react */
import { env } from "@crikket/env/server"
import { sendAuthEmail } from "./send-auth-email"
import type { AuthEmailOtpType } from "./templates/email-otp-template"
import { AuthEmailOtpTemplate } from "./templates/email-otp-template"
import { EmailVerificationLinkTemplate } from "./templates/email-verification-link-template"

type SendEmailOtpEmailInput = {
  email: string
  otp: string
  type: AuthEmailOtpType
}

type SendEmailVerificationLinkEmailInput = {
  email: string
  verificationUrl: string
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

const appUrl = env.CORS_ORIGINS[0]

if (!appUrl) {
  throw new Error(
    "CORS_ORIGINS must include a frontend origin for auth email links."
  )
}

const toAppUrl = (urlOrPath: string): string => {
  const parsed = new URL(urlOrPath, appUrl)
  const appRelativeUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`

  return new URL(appRelativeUrl, appUrl).toString()
}

export const sendEmailOtpEmail = async ({
  email,
  otp,
  type,
}: SendEmailOtpEmailInput): Promise<void> => {
  const actionUrl = new URL(OTP_ACTION_URLS[type], appUrl)

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
  const appVerificationUrl = toAppUrl(verificationUrl)

  await sendAuthEmail({
    to: email,
    subject: "Verify your email address",
    text: `Verify your email using this link: ${appVerificationUrl}`,
    react: (
      <EmailVerificationLinkTemplate verificationUrl={appVerificationUrl} />
    ),
  })
}
