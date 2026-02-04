import { Icons } from "@crikket/ui/components/icons"
import { Loader } from "@crikket/ui/components/loader"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import Image from "next/image"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"

export default function SignInForm() {
  const { isPending } = authClient.useSession()

  const handleGoogleSignIn = async () => {
    await authClient.signIn.social(
      {
        provider: "google",
        callbackURL: "/dashboard",
      },
      {
        onError: (ctx) => {
          toast.error(ctx.error.message)
        },
      }
    )
  }

  if (isPending) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center p-4 pt-[12vh] pb-20">
      <div className="mb-10 flex items-center gap-4">
        <div className="relative h-10 w-10">
          <Image
            alt="Logo"
            className="object-contain"
            fill
            priority
            src="/favicon/favicon.svg"
          />
        </div>
        <h1 className="font-bold text-4xl uppercase tracking-tight">Crikket</h1>
      </div>

      <Card className="w-full max-w-[400px] border-none shadow-xl ring-1 ring-border/50">
        <CardHeader className="space-y-1 pt-8 text-center">
          <CardTitle className="font-bold text-2xl tracking-tight">
            Welcome back
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-2 pb-10">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-muted border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 font-medium text-muted-foreground">
                Continue with socials
              </span>
            </div>
          </div>
          <Button
            className="h-12 w-full font-semibold text-base shadow-sm transition-all hover:bg-muted/50 hover:shadow-md active:scale-[0.98]"
            onClick={handleGoogleSignIn}
            type="button"
            variant="outline"
          >
            <Icons.google className="mr-3 h-5 w-5" />
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
