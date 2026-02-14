import { authClient } from "@crikket/auth/client"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { VerifyEmailForm } from "@/components/auth/verify-email-form"

export const metadata: Metadata = {
  title: "Verify Email",
  description: "Verify your email address to secure your Crikket account.",
}

export default async function VerifyEmailPage() {
  const { data: session } = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  })

  if (!session) {
    redirect("/login")
  }

  if (session.user.emailVerified) {
    redirect("/")
  }

  return <VerifyEmailForm email={session.user.email} />
}
