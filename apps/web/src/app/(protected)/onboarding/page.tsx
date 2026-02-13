import { authClient } from "@crikket/auth/client"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import CreateOrganizationOnboardingForm from "@/app/(protected)/onboarding/_components/create-organization-onboarding-form"

export default async function OnboardingPage() {
  const { data: session } = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  })

  if (!session) {
    redirect("/login")
  }

  const { data: organizations } = await authClient.organization.list({
    fetchOptions: {
      headers: await headers(),
    },
  })

  if (organizations && organizations.length > 0) {
    redirect("/")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <CreateOrganizationOnboardingForm />
    </div>
  )
}
