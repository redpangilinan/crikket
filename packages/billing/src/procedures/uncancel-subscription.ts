import { uncancelOrganizationSubscription } from "../service/checkout/cancel-subscription"
import { protectedProcedure } from "./context"
import {
  optionalOrganizationIdInputSchema,
  resolveOrganizationId,
} from "./organization-id"

export const uncancelSubscription = protectedProcedure
  .input(optionalOrganizationIdInputSchema)
  .handler(({ context, input }) => {
    const organizationId = resolveOrganizationId({
      organizationId: input.organizationId,
      activeOrganizationId: context.session.session.activeOrganizationId,
    })

    return uncancelOrganizationSubscription({
      organizationId,
      userId: context.session.user.id,
    })
  })
