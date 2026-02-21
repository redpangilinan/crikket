import { cancelOrganizationSubscription } from "../service/checkout/cancel-subscription"
import { protectedProcedure } from "./context"
import {
  optionalOrganizationIdInputSchema,
  resolveOrganizationId,
} from "./organization-id"

export const cancelSubscription = protectedProcedure
  .input(optionalOrganizationIdInputSchema)
  .handler(({ context, input }) => {
    const organizationId = resolveOrganizationId({
      organizationId: input.organizationId,
      activeOrganizationId: context.session.session.activeOrganizationId,
    })

    return cancelOrganizationSubscription({
      organizationId,
      userId: context.session.user.id,
    })
  })
