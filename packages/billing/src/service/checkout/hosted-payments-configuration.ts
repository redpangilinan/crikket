const REQUIRED_HOSTED_PAYMENTS_ENV_VARS = [
  "POLAR_ACCESS_TOKEN",
  "POLAR_SUCCESS_URL",
  "POLAR_WEBHOOK_SECRET",
  "POLAR_PRO_PRODUCT_ID",
  "POLAR_PRO_YEARLY_PRODUCT_ID",
  "POLAR_STUDIO_PRODUCT_ID",
  "POLAR_STUDIO_YEARLY_PRODUCT_ID",
] as const

export type HostedPaymentsEnvVar =
  (typeof REQUIRED_HOSTED_PAYMENTS_ENV_VARS)[number]

export type HostedPaymentsConfiguration = {
  ENABLE_PAYMENTS: boolean
  POLAR_ACCESS_TOKEN?: string
  POLAR_SUCCESS_URL?: string
  POLAR_WEBHOOK_SECRET?: string
  POLAR_PRO_PRODUCT_ID?: string
  POLAR_PRO_YEARLY_PRODUCT_ID?: string
  POLAR_STUDIO_PRODUCT_ID?: string
  POLAR_STUDIO_YEARLY_PRODUCT_ID?: string
}

export function resolveMissingHostedPaymentsConfiguration(
  config: HostedPaymentsConfiguration
): HostedPaymentsEnvVar[] {
  if (!config.ENABLE_PAYMENTS) {
    return []
  }

  const isConfigured = (variable: HostedPaymentsEnvVar): boolean =>
    Boolean(config[variable])

  return REQUIRED_HOSTED_PAYMENTS_ENV_VARS.filter(
    (variable) => !isConfigured(variable)
  )
}
