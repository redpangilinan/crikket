import * as z from "zod"

export const loginFormSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

export const registerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export const verifyEmailOtpFormSchema = z.object({
  otp: z.string().length(6, "Code must be 6 digits"),
})

export const forgotPasswordRequestSchema = z.object({
  email: z.email("Enter a valid email address"),
})

export const forgotPasswordResetSchema = z
  .object({
    email: z.email("Enter a valid email address"),
    otp: z.string().length(6, "Code must be 6 digits"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
