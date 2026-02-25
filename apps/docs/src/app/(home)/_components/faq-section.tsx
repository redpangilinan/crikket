"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@crikket/ui/components/ui/accordion"

const faqItems = [
  {
    question: "What is Crikket?",
    answer:
      "Crikket is an open-source bug reporting tool and an alternative to jam.dev and marker.io.",
  },
  {
    question: "What does each bug report include?",
    answer:
      "Reports include reproduction steps, console logs, and network requests to help teams reproduce and debug issues faster.",
  },
  {
    question: "Can I capture both video and screenshots?",
    answer:
      "Yes. Crikket supports both video and screenshot bug report uploads.",
  },
  {
    question: "How can I share a report?",
    answer:
      "You can share any report with a single link and set visibility per report as public or private.",
  },
  {
    question: "What pricing options are available?",
    answer:
      "Hosted Crikket is paid and currently offers Pro and Studio plans. Yearly billing is available with a 20% savings shown in pricing.",
  },
  {
    question: "Is there a free option?",
    answer:
      "Yes. Self-hosting is completely free and open source. Check out the docs for more information.",
  },
] as const

export function FaqSection() {
  return (
    <section
      className="w-full scroll-mt-28 space-y-6 px-4 text-left sm:px-0"
      id="faq"
    >
      <div className="space-y-3 text-center">
        <h2 className="font-bold text-3xl tracking-tight sm:text-4xl">FAQ</h2>
        <p className="mx-auto max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Everything you need to know about Crikket.
        </p>
      </div>

      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-border/60 bg-card/70 px-6 py-2 shadow-sm backdrop-blur-sm">
        <Accordion defaultValue={[faqItems[0].question]}>
          {faqItems.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className="text-base">
                {item.question}
              </AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
