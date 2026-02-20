import { polarClient } from "@crikket/billing/lib/payments"
import { assertHostedPaymentsConfiguration } from "@crikket/billing/service/checkout/shared"
import { assertOrganizationCanAddMembers } from "@crikket/billing/service/entitlements/organization-entitlements"
import { processPolarWebhookPayload } from "@crikket/billing/service/webhooks/process-polar-webhook-payload"
import { db } from "@crikket/db"
import * as schema from "@crikket/db/schema/auth"
import { env } from "@crikket/env/server"
import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins/admin"
import { emailOTP } from "better-auth/plugins/email-otp"
import { organization } from "better-auth/plugins/organization"

import {
  sendEmailOtpEmail,
  sendEmailVerificationLinkEmail,
  sendOrganizationInvitationEmail,
} from "./lib/email/auth-emails"

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const isProduction = env.NODE_ENV === "production"
const trustedOrigins = Array.from(
  new Set([env.BETTER_AUTH_URL, ...env.CORS_ORIGINS])
)
const crossSubDomainCookies = env.BETTER_AUTH_COOKIE_DOMAIN
  ? {
      enabled: true,
      domain: env.BETTER_AUTH_COOKIE_DOMAIN,
    }
  : undefined

const socialProviders =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined

type CheckoutProductSlug = "pro" | "pro-yearly" | "studio" | "studio-yearly"

const checkoutProducts = [
  env.POLAR_PRO_PRODUCT_ID
    ? ({ productId: env.POLAR_PRO_PRODUCT_ID, slug: "pro" } as const)
    : null,
  env.POLAR_PRO_YEARLY_PRODUCT_ID
    ? ({
        productId: env.POLAR_PRO_YEARLY_PRODUCT_ID,
        slug: "pro-yearly",
      } as const)
    : null,
  env.POLAR_STUDIO_PRODUCT_ID
    ? ({ productId: env.POLAR_STUDIO_PRODUCT_ID, slug: "studio" } as const)
    : null,
  env.POLAR_STUDIO_YEARLY_PRODUCT_ID
    ? ({
        productId: env.POLAR_STUDIO_YEARLY_PRODUCT_ID,
        slug: "studio-yearly",
      } as const)
    : null,
].filter(
  (product): product is { productId: string; slug: CheckoutProductSlug } =>
    Boolean(product)
)

const polarCheckout = checkout({
  products: checkoutProducts,
  successUrl: env.POLAR_SUCCESS_URL,
  authenticatedUsersOnly: true,
})

const polarPortal = portal()

const paymentsPlugins = env.ENABLE_PAYMENTS
  ? (() => {
      assertHostedPaymentsConfiguration()

      const webhookSecret = env.POLAR_WEBHOOK_SECRET
      if (!webhookSecret) {
        throw new Error("ENABLE_PAYMENTS=true requires POLAR_WEBHOOK_SECRET")
      }

      return [
        polar({
          client: polarClient,
          createCustomerOnSignUp: true,
          enableCustomerPortal: true,
          use: [
            polarCheckout,
            polarPortal,
            webhooks({
              secret: webhookSecret,
              onPayload: async (payload) => {
                await processPolarWebhookPayload(
                  payload as Record<string, unknown>
                )
              },
            }),
          ],
        }),
      ]
    })()
  : []

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
      "/email-otp/request-password-reset": {
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
    ...(crossSubDomainCookies ? { crossSubDomainCookies } : {}),
    defaultCookieAttributes: {
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      httpOnly: true,
    },
  },
  plugins: [
    admin(),
    organization({
      sendInvitationEmail: async (data) => {
        await sendOrganizationInvitationEmail({
          email: data.email,
          invitationId: data.id,
          inviterName: data.inviter.user.name,
          organizationName: data.organization.name,
          role: data.role,
        })
      },
      organizationHooks: {
        beforeAcceptInvitation: async ({ invitation }) => {
          await assertOrganizationCanAddMembers(invitation.organizationId)
        },
        beforeCreateInvitation: async ({ invitation }) => {
          await assertOrganizationCanAddMembers(invitation.organizationId)
        },
      },
    }),
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
    ...paymentsPlugins,
  ],
})
