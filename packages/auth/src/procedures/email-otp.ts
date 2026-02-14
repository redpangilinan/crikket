import { db } from "@crikket/db"
import * as authSchema from "@crikket/db/schema/auth"
import { ORPCError } from "@orpc/server"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { auth } from "../index"
import { sendEmailOtpEmail } from "../lib/email/auth-emails"
import { protectedProcedure } from "./context"

const EMAIL_VERIFICATION_OTP_TYPE = "email-verification" as const

const sendEmailVerificationOtpStrict = async (
  emailInput: string
): Promise<void> => {
  const email = emailInput.toLowerCase()
  const otpIdentifier = `${EMAIL_VERIFICATION_OTP_TYPE}-otp-${email}`

  try {
    const otp = await auth.api.createVerificationOTP({
      body: {
        email,
        type: EMAIL_VERIFICATION_OTP_TYPE,
      },
    })

    await sendEmailOtpEmail({
      email,
      otp,
      type: EMAIL_VERIFICATION_OTP_TYPE,
    })
  } catch (error) {
    await db
      .delete(authSchema.verification)
      .where(eq(authSchema.verification.identifier, otpIdentifier))
      .catch((deleteError) => {
        console.error("Failed to clean up OTP after send failure", deleteError)
      })

    throw error
  }
}

export const sendEmailVerificationOtpStrictProcedure = protectedProcedure
  .input(z.object({}))
  .handler(async ({ context }) => {
    const email = context.session.user.email.toLowerCase()

    if (context.session.user.emailVerified) {
      return { success: true, alreadyVerified: true }
    }

    try {
      await sendEmailVerificationOtpStrict(email)

      return { success: true, alreadyVerified: false }
    } catch (error) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to send verification code. Please try again.",
        cause: error,
      })
    }
  })
