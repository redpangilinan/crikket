import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Authentication",
  description: "Manage access to your Crikket account.",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      {children}
    </div>
  )
}
