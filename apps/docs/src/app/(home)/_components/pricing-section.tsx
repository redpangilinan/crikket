"use client"

import { env } from "@crikket/env/web"
import { pricingTiers } from "@crikket/shared/config/pricing"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { Check } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export function PricingSection() {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    "monthly"
  )

  const billingUrl = `${env.NEXT_PUBLIC_APP_URL}/settings/billing`

  return (
    <section
      className="flex w-full scroll-mt-28 flex-col items-center space-y-12"
      id="pricing"
    >
      <div className="flex flex-col items-center space-y-3 px-4 text-center sm:px-0">
        <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">
          Pricing
        </h2>
        <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Choose a plan that fits your team and start shipping bug fixes faster.
        </p>
        <p className="max-w-2xl text-balance text-muted-foreground text-sm sm:text-base">
          Prefer self-hosting? It is free and open source.
        </p>

        <div className="relative mt-6 inline-flex rounded-full border border-border p-1">
          <Button
            className="w-28 rounded-full"
            onClick={() => setBillingInterval("monthly")}
            variant={billingInterval === "monthly" ? "default" : "ghost"}
          >
            Monthly
          </Button>
          <Button
            className="w-28 rounded-full"
            onClick={() => setBillingInterval("yearly")}
            variant={billingInterval === "yearly" ? "default" : "ghost"}
          >
            Yearly
          </Button>
          <span className="absolute -top-3 right-0 z-10 rounded-full border border-border bg-background px-2 py-0.5 font-medium text-[10px] text-muted-foreground shadow-sm">
            Save 20%
          </span>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-6 px-4 md:grid-cols-2 md:px-6">
        {pricingTiers.map((tier) => {
          const price =
            billingInterval === "yearly" ? tier.yearlyPrice : tier.monthlyPrice

          return (
            <div className="relative flex w-full text-left" key={tier.slug}>
              {tier.highlighted && (
                <div className="absolute -top-4 right-0 left-0 z-10 flex items-center justify-center">
                  <span className="rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground text-xs shadow-sm">
                    Most Popular
                  </span>
                </div>
              )}
              <Card
                className={`relative flex w-full flex-col transition-all duration-300 hover:shadow-xl ${
                  tier.highlighted
                    ? "border-primary/50 shadow-lg ring-1 ring-primary/20"
                    : "border-border/40 bg-muted/10 hover:border-border/60 hover:bg-muted/30"
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <div className="mb-6 flex items-baseline font-extrabold text-4xl tracking-tight">
                    ${price}
                    <span className="ml-1 font-medium text-lg text-muted-foreground">
                      /{billingInterval === "yearly" ? "yr" : "mo"}
                    </span>
                  </div>
                  <ul className="flex-1 space-y-3">
                    {tier.features.map((feature) => (
                      <li className="flex items-start" key={feature}>
                        <Check className="mr-3 h-5 w-5 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link className="w-full" href={billingUrl}>
                    <Button
                      className="h-12 w-full rounded-xl font-medium text-base"
                      variant={tier.highlighted ? "default" : "secondary"}
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </div>
          )
        })}
      </div>
    </section>
  )
}
