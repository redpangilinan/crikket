import { redirect } from "next/navigation"

import { getProtectedAuthData } from "@/app/(protected)/_lib/get-protected-auth-data"

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { organizations } = await getProtectedAuthData()

  if (organizations.length > 0) {
    redirect("/")
  }

  return children
}
