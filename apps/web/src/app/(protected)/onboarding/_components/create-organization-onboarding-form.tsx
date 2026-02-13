"use client"

import { authClient } from "@crikket/auth/client"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { Field, FieldError, FieldLabel } from "@crikket/ui/components/ui/field"
import { Input } from "@crikket/ui/components/ui/input"
import { useLocalStorage } from "@crikket/ui/hooks/use-local-storage"
import { useForm } from "@tanstack/react-form"
import { useRouter } from "nextjs-toploader/app"
import { toast } from "sonner"
import { organizationFormSchema } from "@/lib/schema/organization"

export default function CreateOrganizationOnboardingForm() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const preferredOrgStorageKey = session?.user.id
    ? `crikket:preferred-org:${session.user.id}`
    : "crikket:preferred-org"
  const { setValue: setPreferredOrganizationId } = useLocalStorage<
    string | null
  >(preferredOrgStorageKey, null)

  const form = useForm({
    defaultValues: {
      name: "",
      slug: "",
    },
    validators: {
      onChange: organizationFormSchema,
    },
    onSubmit: async ({ value }) => {
      const { data, error } = await authClient.organization.create({
        name: value.name,
        slug: value.slug,
      })

      if (error) {
        toast.error(error.message ?? "Failed to create organization")
        return
      }

      if (!data?.id) {
        toast.error("Organization was created without an id")
        return
      }

      setPreferredOrganizationId(data.id)

      const { error: setActiveError } = await authClient.organization.setActive(
        {
          organizationId: data.id,
        }
      )

      if (setActiveError) {
        toast.error(setActiveError.message ?? "Failed to activate organization")
        return
      }

      toast.success("Organization created successfully")
      router.push("/")
      router.refresh()
    },
  })

  return (
    <Card className="w-full max-w-[460px] border-none shadow-xl ring-1 ring-border/50">
      <CardHeader className="space-y-1 pt-8 text-center">
        <CardTitle className="font-bold text-2xl tracking-tight">
          Create your organization
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          You need an organization before you can access your dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-10">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
        >
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && field.state.meta.errors.length > 0

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Organization Name
                  </FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    autoComplete="off"
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      const nextName = event.target.value
                      const previousName = field.state.value

                      field.handleChange(nextName)

                      const currentSlug = form.getFieldValue("slug")
                      const slugifiedPreviousName = (previousName || "")
                        .toLowerCase()
                        .replace(/\s+/g, "-")

                      if (
                        currentSlug.length === 0 ||
                        currentSlug === slugifiedPreviousName
                      ) {
                        form.setFieldValue(
                          "slug",
                          nextName.toLowerCase().replace(/\s+/g, "-")
                        )
                      }
                    }}
                    placeholder="Acme Corp"
                    value={field.state.value}
                  />
                  {isInvalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="slug">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && field.state.meta.errors.length > 0

              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Slug</FieldLabel>
                  <Input
                    aria-invalid={isInvalid}
                    id={field.name}
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="acme-corp"
                    value={field.state.value}
                  />
                  {isInvalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          <Button
            className="mt-2 h-11"
            disabled={form.state.isSubmitting}
            type="submit"
          >
            {form.state.isSubmitting
              ? "Creating organization..."
              : "Create organization"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
