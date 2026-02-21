import { useMutation } from "@tanstack/react-query"
import { useRouter } from "nextjs-toploader/app"
import * as React from "react"
import { toast } from "sonner"

import { setCheckoutPendingGuard } from "@/lib/billing-checkout-guard"
import { client } from "@/utils/orpc"

import type { BillingInterval, SwitchablePlan } from "./types"
import { extractRedirectUrl, getErrorMessage } from "./utils"

interface UseBillingActionsInput {
  organizationId: string
  billingInterval: BillingInterval
}

function getFriendlyPlanChangeErrorMessage(
  error: { message?: string } | null | undefined
): string {
  const rawMessage = getErrorMessage(error, "Failed to change plan")
  const normalizedMessage = rawMessage.toLowerCase()
  const isCancellationConflict =
    normalizedMessage.includes("alreadycanceledsubscription") ||
    normalizedMessage.includes("already canceled") ||
    normalizedMessage.includes("end of the period")

  if (isCancellationConflict) {
    return "This subscription is set to cancel at period end. Resume it first before switching plans."
  }

  return rawMessage
}

export function useBillingActions(input: UseBillingActionsInput) {
  const router = useRouter()
  const [pendingPlan, setPendingPlan] = React.useState<SwitchablePlan | null>(
    null
  )
  const [isPlanConfirmOpen, setIsPlanConfirmOpen] = React.useState(false)
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = React.useState(false)
  const [isUncancelConfirmOpen, setIsUncancelConfirmOpen] =
    React.useState(false)

  const changePlanMutation = useMutation({
    mutationFn: async (nextPlan: SwitchablePlan) => {
      const data = await client.billing.changePlan({
        billingInterval: input.billingInterval,
        organizationId: input.organizationId,
        plan: nextPlan,
      })

      if (data.action === "checkout_required") {
        setCheckoutPendingGuard()
        window.location.assign(data.url)
      }

      return data
    },
    onSuccess: (data, nextPlan) => {
      if (data.action === "checkout_required") {
        return
      }

      if (data.action === "updated") {
        toast.success(
          `Organization plan updated to ${nextPlan === "pro" ? "Pro" : "Studio"}.`
        )
      } else {
        toast.message("Organization is already on that plan.")
      }

      router.refresh()
    },
    onError: (error) => {
      toast.error(getFriendlyPlanChangeErrorMessage(error))
    },
  })

  const portalMutation = useMutation({
    mutationFn: async () => {
      const data = await client.billing.openPortal({
        organizationId: input.organizationId,
      })
      const url = extractRedirectUrl(data)
      if (!url) {
        throw new Error("Portal URL is missing from response.")
      }

      window.location.assign(url)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to open billing portal"))
    },
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () =>
      client.billing.cancelSubscription({
        organizationId: input.organizationId,
      }),
    onSuccess: (data) => {
      if (data.action === "scheduled") {
        toast.success("Subscription cancellation is scheduled for period end.")
      } else if (data.action === "already_scheduled") {
        toast.message("Subscription is already set to cancel at period end.")
      } else {
        toast.message("No updatable subscription found for this organization.")
      }

      router.refresh()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to cancel subscription"))
    },
  })

  const uncancelSubscriptionMutation = useMutation({
    mutationFn: async () =>
      client.billing.uncancelSubscription({
        organizationId: input.organizationId,
      }),
    onSuccess: (data) => {
      if (data.action === "resumed") {
        toast.success("Subscription resumed.")
      } else if (data.action === "already_active") {
        toast.message("Subscription is already active.")
      } else {
        toast.message("No updatable subscription found for this organization.")
      }

      router.refresh()
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to resume subscription"))
    },
  })

  const handlePlanDialogOpenChange = (open: boolean) => {
    setIsPlanConfirmOpen(open)
    if (!open) {
      setPendingPlan(null)
    }
  }

  const handleCancelDialogOpenChange = (open: boolean) => {
    setIsCancelConfirmOpen(open)
  }

  const handleUncancelDialogOpenChange = (open: boolean) => {
    setIsUncancelConfirmOpen(open)
  }

  return {
    pendingPlan,
    isPlanConfirmOpen,
    isCancelConfirmOpen,
    isUncancelConfirmOpen,
    isMutating:
      changePlanMutation.isPending ||
      portalMutation.isPending ||
      cancelSubscriptionMutation.isPending ||
      uncancelSubscriptionMutation.isPending,
    isPlanChangePending: changePlanMutation.isPending,
    isCancelPending: cancelSubscriptionMutation.isPending,
    isUncancelPending: uncancelSubscriptionMutation.isPending,
    handlePlanDialogOpenChange,
    handleCancelDialogOpenChange,
    handleUncancelDialogOpenChange,
    handlePlanSelection: (nextPlan: SwitchablePlan) => {
      setPendingPlan(nextPlan)
      setIsPlanConfirmOpen(true)
    },
    handleConfirmPlanChange: async () => {
      if (!pendingPlan) {
        return
      }

      await changePlanMutation.mutateAsync(pendingPlan)
    },
    requestCancelSubscription: () => setIsCancelConfirmOpen(true),
    requestUncancelSubscription: () => setIsUncancelConfirmOpen(true),
    handleConfirmCancellation: async () => {
      await cancelSubscriptionMutation.mutateAsync()
    },
    handleConfirmUncancel: async () => {
      await uncancelSubscriptionMutation.mutateAsync()
    },
    openPortal: () => portalMutation.mutate(),
  }
}
