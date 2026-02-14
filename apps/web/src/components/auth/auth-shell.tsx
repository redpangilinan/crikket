import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import Image from "next/image"
import type { ReactNode } from "react"

type AuthShellProps = {
  title: string
  description: string
  children: ReactNode
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="flex w-full flex-col items-center p-4 pt-[12vh] pb-20">
      <div className="mb-6 flex items-center gap-2">
        <div className="relative h-10 w-10">
          <Image
            alt="Logo"
            className="object-contain"
            fill
            priority
            src="/favicon/favicon.svg"
          />
        </div>
        <h1 className="font-bold text-4xl tracking-tight">crikket</h1>
      </div>

      <Card className="w-full max-w-[440px] border-none shadow-xl ring-1 ring-border/50">
        <CardHeader className="space-y-1 pt-8 text-center">
          <CardTitle className="font-bold text-2xl tracking-tight">
            {title}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-2 pb-10">{children}</CardContent>
      </Card>
    </div>
  )
}
