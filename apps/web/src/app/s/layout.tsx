import { authClient } from "@crikket/auth/client"
import { Button } from "@crikket/ui/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { headers } from "next/headers"
import Link from "next/link"

export default async function SharedBugReportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const requestHeaders = await headers()
  const { data: session } = await authClient.getSession({
    fetchOptions: {
      headers: requestHeaders,
    },
  })

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link className="font-semibold text-lg tracking-tight" href="/">
            crikket
          </Link>

          {session ? (
            <Link href="/">
              <Button size="sm" variant="ghost">
                <ChevronLeft /> Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm" variant="ghost">
                Login
              </Button>
            </Link>
          )}
        </div>
      </header>

      {children}
    </div>
  )
}
