"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type * as React from "react"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider> & {
  children: React.ReactNode
}) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
