import { isErrorWithCode } from "./errors"

const DEFAULT_MAX_ATTEMPTS = 3
const POSTGRES_UNIQUE_VIOLATION_CODE = "23505"

interface RetryOnUniqueViolationOptions {
  maxAttempts?: number
}

export function isPostgresUniqueViolationError(error: unknown): boolean {
  return isErrorWithCode(error, POSTGRES_UNIQUE_VIOLATION_CODE)
}

export async function retryOnUniqueViolation<T>(
  operation: () => Promise<T>,
  options?: RetryOnUniqueViolationOptions
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!isPostgresUniqueViolationError(error) || attempt === maxAttempts) {
        throw error
      }
    }
  }

  throw new Error("retryOnUniqueViolation exhausted attempts unexpectedly")
}
