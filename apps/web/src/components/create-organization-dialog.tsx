"use client"

import { authClient } from "@crikket/auth/client"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@crikket/ui/components/ui/dialog"
import { Input } from "@crikket/ui/components/ui/input"
import { Label } from "@crikket/ui/components/ui/label"
import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: CreateOrganizationDialogProps) {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await authClient.organization.create(
        {
          name,
          slug,
        },
        {
          onSuccess: (ctx) => {
            toast.success("Organization created successfully")
            onOpenChange(false)
            router.refresh()
            setName("")
            setSlug("")
          },
          onError: (ctx) => {
            toast.error(ctx.error.message)
          },
        }
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Create a new organization to manage your team and projects.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                onChange={(e) => {
                  setName(e.target.value)
                  if (
                    !slug ||
                    slug === name.toLowerCase().replace(/\s+/g, "-")
                  ) {
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                  }
                }}
                placeholder="Acme Corp"
                required
                value={name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-corp"
                required
                value={slug}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isLoading} type="submit">
              {isLoading ? "Creating..." : "Create Organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
