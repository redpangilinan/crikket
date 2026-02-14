import { env } from "@crikket/env/server"
import { render } from "@react-email/render"
import type { ReactElement } from "react"
import { Resend } from "resend"

type SendAuthEmailInput = {
  to: string
  subject: string
  text: string
  react: ReactElement
}

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

export const sendAuthEmail = async ({
  to,
  subject,
  text,
  react,
}: SendAuthEmailInput): Promise<void> => {
  if (!resendClient) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "RESEND_API_KEY is required to send authentication emails"
      )
    }

    console.warn(
      `[auth-email] Missing RESEND_API_KEY. Skipping email delivery for ${to}.`
    )

    return
  }

  const html = await render(react)

  const { error } = await resendClient.emails.send({
    from: env.AUTH_EMAIL_FROM,
    to,
    subject,
    html,
    text,
    ...(env.AUTH_EMAIL_REPLY_TO
      ? {
          replyTo: env.AUTH_EMAIL_REPLY_TO,
        }
      : {}),
  })

  if (error) {
    throw new Error(`Failed to send auth email: ${error.message}`)
  }
}
