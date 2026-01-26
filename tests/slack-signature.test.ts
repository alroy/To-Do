import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { verifySlackSignature, getSlackHeaders } from '../lib/slack/verify-signature'

// Test signing secret
const SIGNING_SECRET = 'test_signing_secret_12345'

// Helper to generate valid signature
function generateSignature(secret: string, timestamp: string, body: string): string {
  const sigBaseString = `v0:${timestamp}:${body}`
  return (
    'v0=' +
    crypto.createHmac('sha256', secret).update(sigBaseString, 'utf8').digest('hex')
  )
}

describe('verifySlackSignature', () => {
  const originalDateNow = Date.now

  beforeEach(() => {
    // Mock Date.now to return a fixed timestamp
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000) // Fixed timestamp
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return true for valid signature', () => {
    const timestamp = '1700000000' // Current time in seconds
    const body = '{"type":"url_verification","challenge":"test123"}'
    const signature = generateSignature(SIGNING_SECRET, timestamp, body)

    const result = verifySlackSignature(SIGNING_SECRET, signature, timestamp, body)
    expect(result).toBe(true)
  })

  it('should return false for invalid signature', () => {
    const timestamp = '1700000000'
    const body = '{"type":"url_verification","challenge":"test123"}'
    const invalidSignature = 'v0=invalid_signature_here'

    const result = verifySlackSignature(SIGNING_SECRET, invalidSignature, timestamp, body)
    expect(result).toBe(false)
  })

  it('should return false for tampered body', () => {
    const timestamp = '1700000000'
    const originalBody = '{"type":"url_verification","challenge":"test123"}'
    const tamperedBody = '{"type":"url_verification","challenge":"hacked"}'
    const signature = generateSignature(SIGNING_SECRET, timestamp, originalBody)

    const result = verifySlackSignature(SIGNING_SECRET, signature, timestamp, tamperedBody)
    expect(result).toBe(false)
  })

  it('should return false for wrong signing secret', () => {
    const timestamp = '1700000000'
    const body = '{"type":"url_verification","challenge":"test123"}'
    const signature = generateSignature('wrong_secret', timestamp, body)

    const result = verifySlackSignature(SIGNING_SECRET, signature, timestamp, body)
    expect(result).toBe(false)
  })

  it('should return false for timestamp older than 5 minutes', () => {
    const oldTimestamp = '1699999000' // More than 5 minutes ago
    const body = '{"type":"url_verification","challenge":"test123"}'
    const signature = generateSignature(SIGNING_SECRET, oldTimestamp, body)

    const result = verifySlackSignature(SIGNING_SECRET, signature, oldTimestamp, body)
    expect(result).toBe(false)
  })

  it('should return false for future timestamp beyond 5 minutes', () => {
    const futureTimestamp = '1700001000' // More than 5 minutes in future
    const body = '{"type":"url_verification","challenge":"test123"}'
    const signature = generateSignature(SIGNING_SECRET, futureTimestamp, body)

    const result = verifySlackSignature(SIGNING_SECRET, signature, futureTimestamp, body)
    expect(result).toBe(false)
  })

  it('should accept timestamp within 5 minute window', () => {
    const validTimestamp = '1699999800' // 200 seconds ago (within 5 min)
    const body = '{"type":"url_verification","challenge":"test123"}'
    const signature = generateSignature(SIGNING_SECRET, validTimestamp, body)

    const result = verifySlackSignature(SIGNING_SECRET, signature, validTimestamp, body)
    expect(result).toBe(true)
  })

  it('should return false for missing signature', () => {
    const timestamp = '1700000000'
    const body = '{"type":"url_verification"}'

    const result = verifySlackSignature(SIGNING_SECRET, '', timestamp, body)
    expect(result).toBe(false)
  })

  it('should return false for missing timestamp', () => {
    const body = '{"type":"url_verification"}'
    const signature = 'v0=something'

    const result = verifySlackSignature(SIGNING_SECRET, signature, '', body)
    expect(result).toBe(false)
  })

  it('should return false for invalid timestamp format', () => {
    const timestamp = 'not_a_number'
    const body = '{"type":"url_verification"}'
    const signature = 'v0=something'

    const result = verifySlackSignature(SIGNING_SECRET, signature, timestamp, body)
    expect(result).toBe(false)
  })

  it('should handle empty body', () => {
    const timestamp = '1700000000'
    const body = ''
    const signature = generateSignature(SIGNING_SECRET, timestamp, body)

    const result = verifySlackSignature(SIGNING_SECRET, signature, timestamp, body)
    expect(result).toBe(true)
  })
})

describe('getSlackHeaders', () => {
  it('should extract Slack headers from Headers object', () => {
    const headers = new Headers({
      'x-slack-signature': 'v0=abc123',
      'x-slack-request-timestamp': '1700000000',
    })

    const result = getSlackHeaders(headers)
    expect(result.signature).toBe('v0=abc123')
    expect(result.timestamp).toBe('1700000000')
  })

  it('should return null for missing headers', () => {
    const headers = new Headers({})

    const result = getSlackHeaders(headers)
    expect(result.signature).toBeNull()
    expect(result.timestamp).toBeNull()
  })
})
