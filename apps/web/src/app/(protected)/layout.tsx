import { redirect } from "next/navigation"

import { getProtectedAuthData } from "@/app/(protected)/_lib/get-protected-auth-data"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = await getProtectedAuthData()

  if (!session) {
    redirect("/login")
  }

  return children
}
