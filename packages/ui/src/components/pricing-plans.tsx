"use client"

import { Check } from "lucide-react"
import type * as React from "react"

import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card"

export type PricingBillingInterval = "monthly" | "yearly"

export interface PricingPlanTier {
  cta: string
  description: string
  features: string[]
  highlighted?: boolean
  monthlyPrice: number
  name: string
  slug: string
  yearlyPrice: number
}

interface PricingPlansProps {
  billingInterval: PricingBillingInterval
  caption?: React.ReactNode
  className?: string
  description?: React.ReactNode
  gridClassName?: string
  id?: string
  onBillingIntervalChange: (billingInterval: PricingBillingInterval) => void
  renderAction: (
    tier: PricingPlanTier,
    context: { billingInterval: PricingBillingInterval }
  ) => React.ReactNode
  title?: React.ReactNode
  tiers: readonly PricingPlanTier[]
}

export function PricingPlans({
  billingInterval,
  caption,
  className,
  description,
  gridClassName,
  id,
  onBillingIntervalChange,
  renderAction,
  title = "Pricing",
  tiers,
}: PricingPlansProps) {
  return (
    <section
      className={cn(
        "flex w-full scroll-mt-28 flex-col items-center space-y-12",
        className
      )}
      id={id}
    >
      <div className="flex flex-col items-center space-y-3 px-4 text-center sm:px-0">
        <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            {description}
          </p>
        ) : null}
        {caption ? (
          <p className="max-w-2xl text-balance text-muted-foreground text-sm sm:text-base">
            {caption}
          </p>
        ) : null}

        <div className="relative mt-6 inline-flex rounded-full border border-border p-1">
          <Button
            className="w-28 rounded-full"
            onClick={() => onBillingIntervalChange("monthly")}
            type="button"
            variant={billingInterval === "monthly" ? "default" : "ghost"}
          >
            Monthly
          </Button>
          <Button
            className="w-28 rounded-full"
            onClick={() => onBillingIntervalChange("yearly")}
            type="button"
            variant={billingInterval === "yearly" ? "default" : "ghost"}
          >
            Yearly
          </Button>
          <span className="absolute -top-3 right-0 z-10 rounded-full border border-border bg-background px-2 py-0.5 font-medium text-[10px] text-muted-foreground shadow-sm">
            Save 20%
          </span>
        </div>
      </div>

      <div
        className={cn(
          "mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 md:px-6 lg:grid-cols-3",
          gridClassName
        )}
      >
        {tiers.map((tier) => {
          const price =
            billingInterval === "yearly" ? tier.yearlyPrice : tier.monthlyPrice

          return (
            <div className="relative flex w-full text-left" key={tier.slug}>
              {tier.highlighted ? (
                <div className="absolute -top-4 right-0 left-0 z-10 flex items-center justify-center">
                  <span className="rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground text-xs shadow-sm">
                    Best Value
                  </span>
                </div>
              ) : null}
              <Card
                className={cn(
                  "relative flex w-full flex-col transition-all duration-300 hover:shadow-xl",
                  tier.highlighted
                    ? "border-primary/50 shadow-lg ring-1 ring-primary/20"
                    : "border-border/40 bg-muted/10 hover:border-border/60 hover:bg-muted/30"
                )}
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
                  {renderAction(tier, { billingInterval })}
                </CardFooter>
              </Card>
            </div>
          )
        })}
      </div>
    </section>
  )
}
