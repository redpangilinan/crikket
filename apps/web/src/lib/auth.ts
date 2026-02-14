export const AUTH_MIN_PASSWORD_LENGTH = 8

const FALLBACK_ERROR_MESSAGE = "Something went wrong. Please try again."

export const getAuthErrorMessage = (
  error: unknown,
  fallbackMessage = FALLBACK_ERROR_MESSAGE
): string => {
  if (!error) {
    return fallbackMessage
  }

  if (typeof error === "string") {
    return error
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "object" && "message" in error) {
    const message = error.message

    if (typeof message === "string" && message.length > 0) {
      return message
    }
  }

  return fallbackMessage
}
