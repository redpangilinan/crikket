export function isIncomingWebhookEventStale(input: {
  incomingOccurredAt?: Date
  lastAppliedWebhookAt?: Date | null
}): boolean {
  if (!(input.incomingOccurredAt && input.lastAppliedWebhookAt)) {
    return false
  }

  return (
    input.incomingOccurredAt.getTime() < input.lastAppliedWebhookAt.getTime()
  )
}
