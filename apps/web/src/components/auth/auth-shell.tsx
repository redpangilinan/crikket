import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import type { ReactNode } from "react"

type AuthShellProps = {
  title: string
  description: string
  children: ReactNode
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="flex w-full flex-col items-center p-4">
      <div className="mb-6 flex items-center gap-2">
        <h1 className="font-bold font-mono text-4xl tracking-tight">crikket</h1>
      </div>

      <Card className="w-full max-w-[440px] border-none shadow-xl ring-1 ring-border/50">
        <CardHeader className="space-y-1 pt-4 text-center">
          <CardTitle className="font-bold text-2xl tracking-tight">
            {title}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-2 pb-4">{children}</CardContent>
      </Card>
    </div>
  )
}
