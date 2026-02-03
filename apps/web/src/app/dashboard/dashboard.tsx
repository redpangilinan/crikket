"use client"

import { Button } from "@crikket/ui/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { orpc } from "@/utils/orpc"

export default function Dashboard({
  customerState,
  session,
}: {
  customerState: ReturnType<typeof authClient.customer.state>
  session: typeof authClient.$Infer.Session
}) {
  const privateData = useQuery(orpc.privateData.queryOptions())

  const hasProSubscription = customerState?.activeSubscriptions?.length! > 0
  console.log("Active subscriptions:", customerState?.activeSubscriptions)

  return (
    <>
      <p>API: {privateData.data?.message}</p>
      <p>Plan: {hasProSubscription ? "Pro" : "Free"}</p>
      {hasProSubscription ? (
        <Button onClick={async () => await authClient.customer.portal()}>
          Manage Subscription
        </Button>
      ) : (
        <Button
          onClick={async () => await authClient.checkout({ slug: "pro" })}
        >
          Upgrade to Pro
        </Button>
      )}
    </>
  )
}
