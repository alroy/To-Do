import crypto from 'crypto'

/**
 * Verifies Slack request signature per Slack's signing verification spec.
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * @param signingSecret - Slack app signing secret
 * @param signature - X-Slack-Signature header value
 * @param timestamp - X-Slack-Request-Timestamp header value
 * @param body - Raw request body string
 * @returns true if signature is valid
 */
export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Validate inputs
  if (!signingSecret || !signature || !timestamp || body === undefined) {
    return false
  }

  // Check timestamp to prevent replay attacks (5 minute window)
  const requestTimestamp = parseInt(timestamp, 10)
  if (isNaN(requestTimestamp)) {
    return false
  }

  const currentTimestamp = Math.floor(Date.now() / 1000)
  const fiveMinutes = 5 * 60

  if (Math.abs(currentTimestamp - requestTimestamp) > fiveMinutes) {
    return false
  }

  // Compute expected signature
  const sigBaseString = `v0:${timestamp}:${body}`
  const expectedSignature =
    'v0=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(sigBaseString, 'utf8')
      .digest('hex')

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    )
  } catch {
    // Lengths don't match
    return false
  }
}

/**
 * Extracts Slack verification headers from a request
 */
export function getSlackHeaders(headers: Headers): {
  signature: string | null
  timestamp: string | null
} {
  return {
    signature: headers.get('x-slack-signature'),
    timestamp: headers.get('x-slack-request-timestamp'),
  }
}

/**
 * Helper to verify a Next.js API request from Slack
 */
export async function verifySlackRequest(
  request: Request,
  signingSecret: string
): Promise<{ valid: boolean; body: string; error?: string }> {
  const { signature, timestamp } = getSlackHeaders(request.headers)

  if (!signature || !timestamp) {
    return { valid: false, body: '', error: 'Missing Slack signature headers' }
  }

  const body = await request.text()

  const valid = verifySlackSignature(signingSecret, signature, timestamp, body)

  if (!valid) {
    return { valid: false, body, error: 'Invalid Slack signature' }
  }

  return { valid: true, body }
}
