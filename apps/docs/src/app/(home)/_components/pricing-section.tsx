"use client"

import { env } from "@crikket/env/web"
import { pricingTiers } from "@crikket/shared/config/pricing"
import { PricingPlans } from "@crikket/ui/components/pricing-plans"
import { Button } from "@crikket/ui/components/ui/button"
import Link from "next/link"
import { useState } from "react"

export function PricingSection() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    "monthly"
  )

  const billingUrl = `${env.NEXT_PUBLIC_APP_URL}/settings/billing`
  const selfHostingDocsUrl = "/docs/self-hosting"

  return (
    <PricingPlans
      billingInterval={billingInterval}
      caption="Prefer self-hosting? Start with the free plan and deploy it yourself."
      description="Choose a plan that fits your team and start shipping bug fixes faster."
      id="pricing"
      onBillingIntervalChange={setBillingInterval}
      renderAction={(tier) => {
        const href = tier.slug === "free" ? selfHostingDocsUrl : billingUrl

        return (
          <Link className="w-full" href={href}>
            <Button
              className="h-12 w-full rounded-xl font-medium text-base"
              variant={tier.highlighted ? "default" : "secondary"}
            >
              {tier.cta}
            </Button>
          </Link>
        )
      }}
      tiers={pricingTiers}
    />
  )
}
