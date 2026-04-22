import * as z from "zod"

import { organizationFormSchema } from "@/lib/schema/organization"

const CAPTURE_ORIGIN_SPLIT_PATTERN = /\r?\n|,/

function hasOnlyValidCaptureOrigins(value: string): boolean {
  const entries = value
    .split(CAPTURE_ORIGIN_SPLIT_PATTERN)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  if (entries.length === 0) {
    return false
  }

  return entries.every((entry) => {
    try {
      const parsedOrigin = new URL(entry)
      return (
        parsedOrigin.protocol === "http:" || parsedOrigin.protocol === "https:"
      )
    } catch {
      return false
    }
  })
}

export const userNameFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
})

export const userPasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export const organizationSettingsFormSchema = organizationFormSchema

export const captureKeyCreateFormSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(80),
  allowedOrigins: z
    .string()
    .trim()
    .min(1, "At least one origin is required")
    .refine(hasOnlyValidCaptureOrigins, {
      message: "Use one valid HTTP(S) origin per line.",
    }),
})

export const captureKeyOriginsFormSchema = z.object({
  allowedOrigins: z
    .string()
    .trim()
    .min(1, "At least one origin is required")
    .refine(hasOnlyValidCaptureOrigins, {
      message: "Use one valid HTTP(S) origin per line.",
    }),
})

export const inviteMemberFormSchema = z.object({
  email: z.email("Enter a valid email address"),
  role: z.enum(["admin", "member"]),
})

export const githubIntegrationFormSchema = z.object({
  repo: z
    .string()
    .trim()
    .regex(/^[^/\s]+\/[^/\s]+$/, {
      message: "Use the format owner/repo",
    }),
  // Token is only required the first time; on updates an empty value means "keep existing".
  token: z.string().optional(),
})
