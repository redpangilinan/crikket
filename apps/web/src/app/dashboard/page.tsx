import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { authClient } from "@/lib/auth-client"

import Dashboard from "./dashboard"

export default async function DashboardPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  })

  if (!session?.user) {
    redirect("/login")
  }

  const { data: customerState } = await authClient.customer.state({
    fetchOptions: {
      headers: await headers(),
    },
  })

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {session.user.name}</p>
      <Dashboard customerState={customerState} session={session} />
    </div>
  )
}
