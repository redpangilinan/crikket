import { AnimatedGridPattern } from "@crikket/ui/components/magicui/animated-grid-pattern"

import { CtaSection } from "./_components/cta-section"
import { FaqSection } from "./_components/faq-section"
import { FeaturesSection } from "./_components/features-section"
import { Hero } from "./_components/hero"
import { LandingFooter } from "./_components/landing-footer"
import { PricingSection } from "./_components/pricing-section"

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-background pt-24 sm:pt-32">
      <AnimatedGridPattern
        className="mask-[radial-gradient(1000px_circle_at_50%_25%,white,transparent)] inset-x-0 inset-y-[-30%] h-[200%] skew-y-12"
        duration={3}
        maxOpacity={0.15}
        numSquares={30}
        repeatDelay={1}
      />

      <main className="z-10 flex w-full max-w-[1400px] flex-1 flex-col items-center space-y-34 px-0 text-center sm:px-4 md:px-8 xl:px-12">
        <Hero />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
