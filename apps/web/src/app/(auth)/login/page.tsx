import { Suspense } from "react"
import { SignInForm } from "@/components/auth/sign-in-form"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  )
}
