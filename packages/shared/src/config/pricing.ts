import {
  billingPlanMonthlyBasePriceUsd,
  billingPlanYearlyBasePriceUsd,
} from "../constants/billing"

export type PricingTier = {
  name: string
  slug: "free" | "pro" | "studio"
  description: string
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  highlighted?: boolean
  cta: string
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Pro",
    slug: "pro",
    description: "For growing teams with up to 15 members",
    monthlyPrice: billingPlanMonthlyBasePriceUsd.pro,
    yearlyPrice: billingPlanYearlyBasePriceUsd.pro,
    features: [
      "Up to 15 team members",
      "Create and manage unlimited bug reports",
      "Video and screenshot bug report uploads",
      "Up to 10 minutes per video recording",
      "Replay with steps, logs, and network requests",
      "Public or private share links per report",
    ],
    highlighted: true,
    cta: "Choose Pro",
  },
  {
    name: "Studio",
    slug: "studio",
    description: "For teams that need unlimited seats",
    monthlyPrice: billingPlanMonthlyBasePriceUsd.studio,
    yearlyPrice: billingPlanYearlyBasePriceUsd.studio,
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Up to 20 minutes per video recording",
    ],
    cta: "Choose Studio",
  },
]
