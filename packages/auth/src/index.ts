import { db } from "@crikket/db"
import * as schema from "@crikket/db/schema/auth"
import { env } from "@crikket/env/server"
import { checkout, polar, portal } from "@polar-sh/better-auth"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins/admin"
import { emailOTP } from "better-auth/plugins/email-otp"
import { organization } from "better-auth/plugins/organization"

import {
  sendEmailOtpEmail,
  sendEmailVerificationLinkEmail,
  sendPasswordResetLinkEmail,
} from "./lib/email/auth-emails"
import { polarClient } from "./lib/payments"

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const isProduction = env.NODE_ENV === "production"
const trustedOrigins = Array.from(
  new Set([env.BETTER_AUTH_URL, ...env.CORS_ORIGINS])
)

const socialProviders =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined

export const auth = betterAuth({
  appName: "crikket",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins,
  ...(socialProviders ? { socialProviders } : {}),
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmailVerificationLinkEmail({
        email: user.email,
        verificationUrl: url,
      })
    },
    sendOnSignUp: false,
    sendOnSignIn: false,
    expiresIn: DAY,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetLinkEmail({
        email: user.email,
        resetUrl: url,
      })
    },
    resetPasswordTokenExpiresIn: HOUR,
    revokeSessionsOnPasswordReset: true,
  },
  session: {
    expiresIn: 14 * DAY,
    updateAge: DAY,
    cookieCache: {
      enabled: true,
      maxAge: HOUR,
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: MINUTE,
    max: 100,
    customRules: {
      "/sign-in/email": {
        window: MINUTE,
        max: 5,
      },
      "/sign-up/email": {
        window: MINUTE,
        max: 3,
      },
      "/request-password-reset": {
        window: MINUTE,
        max: 5,
      },
      "/email-otp/send-verification-otp": {
        window: MINUTE,
        max: 5,
      },
      "/email-otp/reset-password": {
        window: MINUTE,
        max: 5,
      },
    },
  },
  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      httpOnly: true,
    },
  },
  plugins: [
    admin(),
    organization(),
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        await sendEmailOtpEmail({
          email,
          otp,
          type,
        })
      },
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
      expiresIn: 10 * MINUTE,
      otpLength: 6,
      allowedAttempts: 5,
      storeOTP: "hashed",
    }),
    ...(env.ENABLE_PAYMENTS
      ? [
          polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            enableCustomerPortal: true,
            use: [
              checkout({
                products: [
                  {
                    productId: env.POLAR_PRODUCT_ID || "",
                    slug: "pro",
                  },
                ],
                successUrl: env.POLAR_SUCCESS_URL,
                authenticatedUsersOnly: true,
              }),
              portal(),
            ],
          }),
        ]
      : []),
  ],
})
