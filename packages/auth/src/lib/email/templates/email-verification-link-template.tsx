/** @jsxImportSource react */
import { Button, Heading, Text } from "@react-email/components"
import { AuthEmailLayout } from "./auth-email-layout"

type EmailVerificationLinkTemplateProps = {
  verificationUrl: string
}

export function EmailVerificationLinkTemplate({
  verificationUrl,
}: EmailVerificationLinkTemplateProps) {
  return (
    <AuthEmailLayout previewText="Verify your email address to continue.">
      <Heading style={headingStyle}>Verify your email</Heading>
      <Text style={descriptionStyle}>
        Click the button below to verify your email address and activate your
        account.
      </Text>
      <Button href={verificationUrl} style={buttonStyle}>
        Verify email
      </Button>
      <Text style={helpTextStyle}>
        This verification link expires in 24 hours.
      </Text>
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
