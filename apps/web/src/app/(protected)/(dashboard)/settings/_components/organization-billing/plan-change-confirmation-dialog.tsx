"use client"

import { ConfirmationDialog } from "@crikket/ui/components/dialogs/confirmation-dialog"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@crikket/ui/components/ui/alert"

import type { BillingInterval, SwitchablePlan } from "./types"
import { formatMoney, formatPlanLabel } from "./utils"

interface PlanChangeConfirmationDialogProps {
  billingInterval: BillingInterval
  isLoading: boolean
  onConfirm: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  pendingPlan: SwitchablePlan | null
  pendingPlanPrice: number
}

export function PlanChangeConfirmationDialog({
  billingInterval,
  isLoading,
  onConfirm,
  onOpenChange,
  open,
  pendingPlan,
  pendingPlanPrice,
}: PlanChangeConfirmationDialogProps) {
  return (
    <ConfirmationDialog
      cancelText="Keep current plan"
      confirmText={
        pendingPlan ? `Confirm ${formatPlanLabel(pendingPlan)}` : "Confirm"
      }
      content={
        pendingPlan ? (
          <Alert>
            <AlertTitle>Billing notice</AlertTitle>
            <AlertDescription>
              Your plan updates right away. Any unused time on your current plan
              is automatically applied as a credit, and any difference is
              charged to your payment method.
            </AlertDescription>
          </Alert>
        ) : null
      }
      description={
        pendingPlan
          ? `Switch this organization to ${formatPlanLabel(pendingPlan)} at ${formatMoney(
              pendingPlanPrice,
              billingInterval
            )}. Your next renewal will follow this new plan.`
          : ""
      }
      isLoading={isLoading}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title={
        pendingPlan
          ? `Change plan to ${formatPlanLabel(pendingPlan)}?`
          : "Change plan"
      }
    />
  )
}
