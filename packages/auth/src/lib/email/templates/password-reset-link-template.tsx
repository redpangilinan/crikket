/** @jsxImportSource react */
import { Button, Heading, Text } from "@react-email/components"
import { AuthEmailLayout } from "./auth-email-layout"

type PasswordResetLinkTemplateProps = {
  resetUrl: string
}

export function PasswordResetLinkTemplate({
  resetUrl,
}: PasswordResetLinkTemplateProps) {
  return (
    <AuthEmailLayout previewText="Reset your password using this secure link.">
      <Heading style={headingStyle}>Reset your password</Heading>
      <Text style={descriptionStyle}>
        Click the button below to create a new password for your account.
      </Text>
      <Button href={resetUrl} style={buttonStyle}>
        Reset password
      </Button>
      <Text style={helpTextStyle}>
        This reset link expires in 1 hour and can only be used once.
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
