import type { Metadata } from "next"

import { SignUpForm } from "@/components/auth/sign-up-form"

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your Crikket account.",
}

export default function RegisterPage() {
  return <SignUpForm />
}
