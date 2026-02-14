/** @jsxImportSource react */
import { Button, Heading, Text } from "@react-email/components"
import { AuthEmailLayout } from "./auth-email-layout"

export type AuthEmailOtpType =
  | "email-verification"
  | "forget-password"
  | "sign-in"

type AuthEmailOtpTemplateProps = {
  otp: string
  type: AuthEmailOtpType
  actionUrl: string
}

const OTP_COPY: Record<
  AuthEmailOtpType,
  {
    title: string
    previewText: string
    description: string
    buttonText: string
  }
> = {
  "email-verification": {
    title: "Verify your email",
    previewText: "Your verification code is ready.",
    description: "Use this code to verify your account email.",
    buttonText: "Open verification page",
  },
  "forget-password": {
    title: "Reset your password",
    previewText: "Your password reset code is ready.",
    description: "Use this code to reset your account password.",
    buttonText: "Open reset page",
  },
  "sign-in": {
    title: "Complete your sign in",
    previewText: "Your one-time sign-in code is ready.",
    description: "Use this code to complete your sign in.",
    buttonText: "Open sign-in page",
  },
}

export function AuthEmailOtpTemplate({
  otp,
  type,
  actionUrl,
}: AuthEmailOtpTemplateProps) {
  const copy = OTP_COPY[type]

  return (
    <AuthEmailLayout previewText={copy.previewText}>
      <Heading style={headingStyle}>{copy.title}</Heading>
      <Text style={descriptionStyle}>{copy.description}</Text>
      <Text style={otpCodeStyle}>{otp}</Text>
      <Button href={actionUrl} style={buttonStyle}>
        {copy.buttonText}
      </Button>
      <Text style={helpTextStyle}>This code expires in 10 minutes.</Text>
    </AuthEmailLayout>
  )
}

const headingStyle = {
  fontSize: "24px",
  fontWeight: "700",
  letterSpacing: "-0.01em",
  lineHeight: "32px",
  margin: "0 0 8px",
}

const descriptionStyle = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 20px",
}

const otpCodeStyle = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  color: "#0f172a",
  fontSize: "32px",
  fontWeight: "700",
  letterSpacing: "8px",
  lineHeight: "40px",
  margin: "0 0 20px",
  padding: "20px 24px",
  textAlign: "center" as const,
}

const buttonStyle = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  padding: "10px 16px",
  textDecoration: "none",
}

const helpTextStyle = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "20px",
  margin: "16px 0 0",
}
